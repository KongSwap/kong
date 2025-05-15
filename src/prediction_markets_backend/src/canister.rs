use candid::{CandidType, Deserialize, Principal};
use ic_cdk::{caller, query, update};
use ic_cdk::api::time;
use std::cell::RefCell;
use std::collections::BTreeMap;
use icrc_ledger_types::icrc21::errors::ErrorInfo;
use icrc_ledger_types::icrc21::requests::{ConsentMessageRequest, ConsentMessageMetadata};
use icrc_ledger_types::icrc21::responses::{ConsentInfo, ConsentMessage};
use candid::decode_one;
use num_traits::ToPrimitive;

use crate::types::{MarketId, Timestamp, TokenAmount, OutcomeIndex, NANOS_PER_SECOND};
use crate::token::registry::{TokenInfo, get_all_supported_tokens, get_token_info, add_supported_token as add_token, update_token_config as update_token};

use super::delegation::*;
use crate::market::estimate_return_types::*;
use crate::constants::PLATFORM_FEE_PERCENTAGE;
use crate::stable_memory::*;

// Helper function to get current time in nanoseconds as a Timestamp type
pub fn get_current_time() -> Timestamp {
    Timestamp::from(time())
}

// Helper function to get current time in seconds
pub fn get_current_time_seconds() -> Timestamp {
    Timestamp::from(time() / NANOS_PER_SECOND)
}

// We'll implement our own simple hash function since we don't have sha2
pub fn hash_principals(principals: &[Principal]) -> Vec<u8> {
    let mut result = Vec::new();
    for principal in principals {
        result.extend_from_slice(principal.as_slice());
    }
    result
}

#[derive(CandidType, Deserialize, Debug)]
pub struct ICRC21ConsentMessageRequest {
    pub canister: Principal,
    pub method: String,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct ICRC21ConsentMessageResponse {
    pub consent_message: String,
}

/// Generates a consent message for ICRC-21 canister calls
/// This follows the specification from https://github.com/dfinity/wg-identity-authentication/blob/main/topics/ICRC-21/icrc_21_consent_msg.md
#[query]
pub fn icrc21_canister_call_consent_message(consent_msg_request: ConsentMessageRequest) -> Result<ConsentInfo, ErrorInfo> {
    let caller_principal = caller();
    
    let consent_message = match consent_msg_request.method.as_str() {
        "create_message" => create_message_consent(&consent_msg_request, caller_principal),
        "resolve_via_admin | resolve_via_admin_legacy | propose_resolution" => resolve_via_admin_consent(&consent_msg_request, caller_principal),
        "void_market" => void_market_consent(&consent_msg_request, caller_principal),
        "place_bet" => place_bet_consent(&consent_msg_request, caller_principal),
        // Default case for other methods
        _ => Ok(ConsentMessage::GenericDisplayMessage(
            format!("Approve KongSwap Prediction Markets to execute {}?", 
                consent_msg_request.method,
            )
        )),
    }?;

    let metadata = ConsentMessageMetadata {
        language: "en".to_string(),
        utc_offset_minutes: None,
    };

    Ok(ConsentInfo { metadata, consent_message })
}

// Helper function for "create_message" consent
fn create_message_consent(
    consent_msg_request: &ConsentMessageRequest,
    caller_principal: Principal
) -> Result<ConsentMessage, ErrorInfo> {
    let message = decode_one::<String>(&consent_msg_request.arg)
        .map_err(|e| ErrorInfo { 
            description: format!("Failed to decode message: {}", e) 
        })?;

    Ok(ConsentMessage::GenericDisplayMessage(format!(
        "# Approve KongSwap Prediction Markets Message\n\nMessage: {}\n\nFrom: {}",
        message,
        caller_principal
    )))
}

// Helper function for "resolve_via_admin" consent
fn resolve_via_admin_consent(
    consent_msg_request: &ConsentMessageRequest,
    caller_principal: Principal
) -> Result<ConsentMessage, ErrorInfo> {
    // Try to decode the parameters using our shared type
    let args = match decode_one::<ResolutionArgs>(&consent_msg_request.arg) {
        Ok(args) => args,
        Err(decode_err) => {
            // If we can't decode properly, provide a generic message with the error
            return Ok(ConsentMessage::GenericDisplayMessage(
                format!("# Resolve KongSwap Prediction Market\n\nYou are about to resolve a prediction market as an admin.\n\nThis action is irreversible and will distribute payouts to winners.\n\nRequested by: {}. Error: {}", 
                    caller_principal, 
                    decode_err
                )
            ));
        }
    };
    
    // Get market_id and outcome indices directly from the args
    let market_id = args.market_id;
    let winning_outcome_indices: Vec<u64> = args.winning_outcomes.iter()
        .map(|o| o.to_u64())
        .collect();
        
    // Try to get market details to show more context
    let market_details = MARKETS.with(|markets| {
        let markets_ref = markets.borrow();
        markets_ref.get(&market_id).map(|market| {
            let question = market.question.clone();
            let outcomes = market.outcomes.clone();
            (question, outcomes)
        })
    });
    
    // Format the consent message based on whether we could retrieve market details
    if let Some((question, outcomes)) = market_details {
        // Get the names of the winning outcomes
        let winning_outcome_names: Vec<String> = winning_outcome_indices.iter()
            .filter_map(|&idx| {
                if idx < outcomes.len() as u64 {
                    Some(outcomes[idx as usize].clone())
                } else {
                    None
                }
            })
            .collect();
        
        Ok(ConsentMessage::GenericDisplayMessage(format!(
            "# Resolve KongSwap Prediction Market\n\nQuestion: {}\n\nSelected outcome{}: {}\n\nThis action is irreversible and will distribute payouts to winners.\n\nRequested by: {}",
            question,
            if winning_outcome_names.len() > 1 { "s" } else { "" },
            winning_outcome_names.join(", "),
            caller_principal
        )))
    } else {
        // Generic message if we couldn't get market details
        Ok(ConsentMessage::GenericDisplayMessage(format!(
            "# Resolve KongSwap Prediction Market\n\nMarket ID: {}\n\nSelected outcome{}: {}\n\nThis action is irreversible and will distribute payouts to winners.\n\nRequested by: {}",
            market_id.to_u64(),
            if winning_outcome_indices.len() > 1 { "s" } else { "" },
            winning_outcome_indices.iter().map(|o| o.to_string()).collect::<Vec<String>>().join(", "),
            caller_principal
        )))
    }
}

// Helper function for "void_market" consent
fn void_market_consent(
    consent_msg_request: &ConsentMessageRequest,
    caller_principal: Principal
) -> Result<ConsentMessage, ErrorInfo> {
    // Try decoding as a direct nat
    let market_id = match decode_one::<candid::Nat>(&consent_msg_request.arg) {
        Ok(id) => id,
        Err(_) => {
            // Handle failure by using a generic message instead
            return Ok(ConsentMessage::GenericDisplayMessage(
                format!("# Void KongSwap Prediction Market\n\nYou are about to void a prediction market and return all bets to users.\n\nThis action is irreversible and should only be used when a market cannot be properly resolved.\n\nRequested by: {}", 
                    caller_principal
                )
            ));
        }
    };

    Ok(ConsentMessage::GenericDisplayMessage(format!(
        "# Void KongSwap Prediction Market\n\nYou are about to void market #{} and return all bets to users.\n\nThis action is irreversible and should only be used when a market cannot be properly resolved.\n\nRequested by: {}",
        market_id,
        caller_principal
    )))
}

// Helper function for "place_bet" consent
fn place_bet_consent(
    consent_msg_request: &ConsentMessageRequest,
    caller_principal: Principal
) -> Result<ConsentMessage, ErrorInfo> {
    // Try to decode place_bet parameters
    match decode_one::<PlaceBetArgs>(&consent_msg_request.arg) {
        Ok(args) => {
            // Use MarketId directly 
            let market_id_val = args.market_id.clone();
            
            // Try to get market data to show more context
            let market_data = match MARKETS.with(|markets| {
                let markets_ref = markets.borrow();
                markets_ref.get(&market_id_val).map(|m| m.clone())
            }) {
                Some(market) => {
                    let outcome_idx = args.outcome_index.to_u64() as usize;
                    let outcome_name = if outcome_idx < market.outcomes.len() {
                        market.outcomes[outcome_idx].clone()
                    } else {
                        format!("Outcome #{}", args.outcome_index.to_u64())
                    };
                    
                    // Get token info for better display
                    let token_id = args.token_id.unwrap_or_else(|| market.token_id.clone());
                    let token_info = get_token_info(&token_id);
                    let token_symbol = token_info.as_ref().map(|info| info.symbol.clone()).unwrap_or_else(|| token_id.clone());
                    let decimals = token_info.map(|info| info.decimals).unwrap_or(0) as u32;
                    
                    // Format amount using TokenAmount directly
                    let amount_decimal = args.amount.to_f64() / 10f64.powi(decimals as i32);
                    
                    format!(
                        "# Place Bet on KongSwap Prediction Market\n\nMarket: {}\n\nOutcome: {}\n\nAmount: {} {}\n\nThis will transfer tokens from your account to the prediction market canister.",
                        market.question,
                        outcome_name,
                        amount_decimal,
                        token_symbol
                    )
                },
                None => {
                    // If we can't find the market, provide more generic message
                    format!(
                        "# Place Bet on KongSwap Prediction Market\n\nMarket ID: {}\n\nOutcome: {}\n\nAmount: {}\n\nThis will transfer tokens from your account to the prediction market canister.",
                        args.market_id.to_u64(),
                        args.outcome_index.to_u64(),
                        args.amount.to_u64()
                    )
                }
            };
            
            Ok(ConsentMessage::GenericDisplayMessage(market_data))
        },
        Err(e) => {
            // If we can't decode properly, return a generic message with error details for debugging
            Ok(ConsentMessage::GenericDisplayMessage(
                format!("# Place Bet on KongSwap Prediction Market\n\nYou are about to place a bet on a prediction market.\n\nThis will transfer tokens from your account to the prediction market canister.\n\nRequested by: {}\n\nDebug info: Failed to decode args: {}", 
                    caller_principal,
                    e
                )
            ))
        }
    }
}

/// Returns current delegations for the caller that match the requested targets
#[query]
pub fn icrc_34_get_delegation(request: DelegationRequest) -> Result<DelegationResponse, DelegationError> {
    request.validate()?;

    let caller_principal = caller();
    let targets_hash = request.compute_targets_hash();

    let delegations = DELEGATIONS.with(|store| {
        store
            .borrow()
            .get(&caller_principal)
            .map(|d| d.as_vec().clone())
            .unwrap_or_default()
            .into_iter()
            .filter(|d| !d.is_expired() && d.targets_list_hash == targets_hash)
            .collect::<Vec<_>>()
    });

    Ok(DelegationResponse { delegations })
}

/// Creates a new delegation for the specified targets
#[update]
pub fn icrc_34_delegate(request: DelegationRequest) -> Result<DelegationResponse, DelegationError> {
    request.validate()?;

    let caller_principal = caller();
    let current_time = get_current_time();
    let targets_hash = request.compute_targets_hash();

    let delegation = Delegation {
        target: caller_principal,
        created: current_time.to_u64(),
        expiration: request.expiration,
        targets_list_hash: targets_hash,
    };

    DELEGATIONS.with(|store| {
        let mut store = store.borrow_mut();
        let mut user_delegations = store.get(&caller_principal).unwrap_or_default();

        // Remove expired delegations
        user_delegations.retain(|d| !d.is_expired());

        // Add new delegation
        user_delegations.push(delegation.clone());

        store.insert(caller_principal, user_delegations);
        Ok(DelegationResponse {
            delegations: vec![delegation],
        })
    })
}

/// Revokes delegations for the specified targets
#[update]
pub fn icrc_34_revoke_delegation(request: RevokeDelegationRequest) -> Result<(), DelegationError> {
    if request.targets.is_empty() {
        return Err(DelegationError::InvalidRequest("No targets specified".to_string()));
    }

    let caller_principal = caller();
    let targets_hash = {
        let mut targets = request.targets;
        targets.sort();
        hash_principals(&targets)
    };

    DELEGATIONS.with(|store| {
        let mut store = store.borrow_mut();
        let mut user_delegations = store.get(&caller_principal).unwrap_or_default();

        // Remove delegations with matching hash
        user_delegations.retain(|d| d.targets_list_hash != targets_hash);

        store.insert(caller_principal, user_delegations);
        Ok(())
    })
}

#[derive(CandidType, Clone, Debug, Deserialize)]
pub struct Icrc28TrustedOriginsResponse {
    pub trusted_origins: Vec<String>,
}

// list every base URL that users will authenticate to your app from
#[query]
fn icrc28_trusted_origins() -> Icrc28TrustedOriginsResponse {
    let trusted_origins = vec![
        format!("https://edoy4-liaaa-aaaar-qakha-cai.localhost:5173"), // svelte FE
        format!("http://localhost:5173"),
        String::from("https://kongswap.io"),
        String::from("https://www.kongswap.io"),
        String::from("https://edoy4-liaaa-aaaar-qakha-cai.icp0.io"),
        String::from("https://dev.kongswap.io"),
    ];

    Icrc28TrustedOriginsResponse { trusted_origins }
}

/// Estimate the potential return for a bet
#[query]
pub fn estimate_bet_return(
    market_id: u64,
    outcome_index: u64,
    bet_amount: u64,
    current_time: u64,
    // token_id is now optional and unused, keeping for API compatibility
    _token_id: Option<String>,
) -> EstimatedReturn {
    // Convert primitive parameters to our type system
    let market_id = MarketId::from(market_id);
    let outcome_index = OutcomeIndex::from(outcome_index);
    let bet_amount = TokenAmount::from(bet_amount);
    let current_time = Timestamp::from(current_time);
    
    MARKETS.with(|markets| {
        let markets = markets.borrow();
        if let Some(market) = markets.get(&market_id) {
            match super::market::estimate_return::estimate_bet_return(
                &market,
                outcome_index.clone(),
                bet_amount.clone(),
                current_time.clone()
            ) {
                Ok(estimate) => estimate,
                Err(_) => {
                    // Return a default estimate on error
                    EstimatedReturn {
                        market_id,
                        outcome_index,
                        bet_amount,
                        current_market_pool: TokenAmount::from(0u64),
                        current_outcome_pool: TokenAmount::from(0u64),
                        scenarios: vec![],
                        uses_time_weighting: false,
                        time_weight_alpha: None,
                        current_time,
                        platform_fee_percentage: Some(PLATFORM_FEE_PERCENTAGE),
                        estimated_platform_fee: Some(TokenAmount::from(0u64)),
                    }
                }
            }
        } else {
            // Return a default estimate if market not found
            EstimatedReturn {
                market_id,
                outcome_index,
                bet_amount,
                current_market_pool: TokenAmount::from(0u64),
                current_outcome_pool: TokenAmount::from(0u64),
                scenarios: vec![],
                uses_time_weighting: false,
                time_weight_alpha: None,
                current_time,
                platform_fee_percentage: Some(PLATFORM_FEE_PERCENTAGE),
                estimated_platform_fee: Some(TokenAmount::from(0u64)),
            }
        }
    })
}

/// Generate data points for visualizing the time weight curve
#[query]
pub fn generate_time_weight_curve(
    market_id: u64,
    points: u64
) -> Vec<TimeWeightPoint> {
    // Convert market_id to our type system
    let market_id = MarketId::from(market_id);
    
    MARKETS.with(|markets| {
        let markets = markets.borrow();
        if let Some(market) = markets.get(&market_id) {
            match super::market::estimate_return::generate_time_weight_curve(&market, points as usize) {
                Ok(curve) => curve,
                Err(_) => vec![]
            }
        } else {
            vec![]
        }
    })
}

/// Simulate the weight of a bet at a specified future time
#[query]
pub fn simulate_future_weight(
    market_id: u64,
    bet_time: u64,
    future_time: u64
) -> f64 {
    // Convert parameters to our type system
    let market_id = MarketId::from(market_id);
    let bet_time = Timestamp::from(bet_time);
    let future_time = Timestamp::from(future_time);
    
    MARKETS.with(|markets| {
        let markets = markets.borrow();
        if let Some(market) = markets.get(&market_id) {
            match super::market::estimate_return::simulate_future_weight(&market, bet_time.clone(), future_time.clone()) {
                Ok(weight) => weight,
                Err(_) => 1.0
            }
        } else {
            1.0
        }
    })
}

// Thread-local storage for market payout records
thread_local! {
    static MARKET_PAYOUTS: RefCell<BTreeMap<MarketId, Vec<BetPayoutRecord>>> = 
        RefCell::new(BTreeMap::new());
}

/// Record a payout for a market
pub fn record_market_payout(payout: BetPayoutRecord) {
    let market_id = payout.market_id.clone();
    
    MARKET_PAYOUTS.with(|payouts| {
        let mut payouts = payouts.borrow_mut();
        
        // Get existing payouts or create a new vector
        let mut market_payouts = if let Some(existing) = payouts.get(&market_id) {
            existing.clone()
        } else {
            Vec::new()
        };
        
        // Add the new payout record
        market_payouts.push(payout);
        
        // Update the storage
        payouts.insert(market_id, market_payouts);
    });
}

/// Get payout records for a market
#[query]
pub fn get_supported_tokens() -> Vec<TokenInfo> {
    get_all_supported_tokens()
}

#[query]
pub fn get_token_fee_percentage(token_id: String) -> Option<u64> {
    get_token_info(&token_id).map(|info| info.fee_percentage)
}

#[update]
pub fn add_supported_token(token_info: TokenInfo) -> Result<(), String> {
    // Check caller is admin
    if !crate::controllers::admin::is_admin(ic_cdk::caller()) {
        return Err("Unauthorized: caller is not an admin".to_string());
    }
    
    add_token(token_info);
    Ok(())
}

#[update]
pub fn update_token_config(token_id: String, token_info: TokenInfo) -> Result<(), String> {
    // Check caller is admin
    if !crate::controllers::admin::is_admin(ic_cdk::caller()) {
        return Err("Unauthorized: caller is not an admin".to_string());
    }
    
    if token_id != token_info.id {
        return Err("Token ID mismatch".to_string());
    }
    
    update_token(token_info);
    Ok(())
}

#[query]
pub fn get_market_payout_records(market_id: u64) -> Vec<BetPayoutRecord> {
    // Convert market_id to our type system
    let market_id = MarketId::from(market_id);
    
    MARKET_PAYOUTS.with(|payouts| {
        let payouts = payouts.borrow();
        if let Some(market_payouts) = payouts.get(&market_id) {
            market_payouts.clone()
        } else {
            vec![]
        }
    })
}

/// Get markets created by a specific user with pagination and sorting
#[query]
pub fn get_markets_by_creator(args: crate::market::get_markets_by_creator::GetMarketsByCreatorArgs) 
    -> crate::market::get_markets_by_creator::GetMarketsByCreatorResult 
{
    crate::market::get_markets_by_creator::get_markets_by_creator(args)
}

/// Search for markets by text in the question with optional filtering and sorting
#[query]
pub fn search_markets(args: crate::market::search_markets::SearchMarketsArgs) 
    -> crate::market::search_markets::SearchMarketsResult 
{
    crate::market::search_markets::search_markets(args)
}

// Define types for consent message arguments
#[derive(CandidType, Clone, Debug, Deserialize)]
pub struct PlaceBetArgs {
    pub market_id: MarketId,
    pub outcome_index: OutcomeIndex,
    pub amount: TokenAmount,
    pub token_id: Option<String>
}

// Define shared type for resolve_via_admin arguments
#[derive(CandidType, Clone, Debug, Deserialize)]
pub struct ResolutionArgs {
    pub market_id: MarketId,
    pub winning_outcomes: Vec<OutcomeIndex>
}
