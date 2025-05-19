use candid::{CandidType, Deserialize, Principal};
use ic_cdk::{caller, query, update};
use ic_cdk::api::time;
use std::cell::RefCell;
use std::collections::BTreeMap;
use icrc_ledger_types::icrc21::errors::ErrorInfo;
use icrc_ledger_types::icrc21::requests::{ConsentMessageRequest, ConsentMessageMetadata};
use icrc_ledger_types::icrc21::responses::{ConsentInfo, ConsentMessage};
use candid::decode_one;

use crate::types::{MarketId, TokenAmount, OutcomeIndex, NANOS_PER_SECOND};
pub use crate::types::Timestamp;
use crate::token::registry::{TokenInfo, get_all_supported_tokens, get_token_info, add_supported_token as add_token, update_token_config as update_token};
use crate::types::MarketResolutionDetails;

use super::delegation::*;
use crate::market::estimate_return_types::*;
use crate::constants::PLATFORM_FEE_PERCENTAGE;
use crate::storage::{DELEGATIONS, MARKETS};

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
        "create_message" => {
            let message = decode_one::<String>(&consent_msg_request.arg)
                .map_err(|e| ErrorInfo { 
                    description: format!("Failed to decode message: {}", e) 
                })?;

            ConsentMessage::GenericDisplayMessage(format!(
                "# Approve KongSwap Prediction Markets Message\n\nMessage: {}\n\nFrom: {}",
                message,
                caller_principal
            ))
        },
        // Add other method matches here as needed
        _ => ConsentMessage::GenericDisplayMessage(
            format!("Approve KongSwap Prediction Markets to execute {}?", 
                consent_msg_request.method,
            )
        ),
    };

    let metadata = ConsentMessageMetadata {
        language: "en".to_string(),
        utc_offset_minutes: None,
    };

    Ok(ConsentInfo { metadata, consent_message })
}

/// Returns current delegations for the caller that match the requested targets
#[query]
pub fn icrc_34_get_delegation(request: DelegationRequest) -> Result<DelegationResponse, DelegationError> {
    request.validate()?;

    let caller_principal = caller();
    let targets_hash = request.compute_targets_hash();

    let delegations = DELEGATIONS.with(|store| {
        // Get a list of all delegations for this user
        let store = store.borrow();
        let mut filtered_delegations = Vec::new();
        
        // Iterate through each delegation for this principal and filter as needed
        for (principal, delegation) in store.iter() {
            if principal == caller_principal && 
               !delegation.is_expired() && 
               delegation.targets_list_hash == targets_hash {
                filtered_delegations.push(delegation.clone());
            }
        }
        
        filtered_delegations
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
        
        // We simply insert the new delegation, replacing any previous one
        // that might have existed for this user with the same targets hash
        store.insert(caller_principal, delegation.clone());
        
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
        
        // Find and remove any delegations matching this user and targets hash
        let mut keys_to_remove = Vec::new();
        for (principal, delegation) in store.iter() {
            if principal == caller_principal && delegation.targets_list_hash == targets_hash {
                keys_to_remove.push(principal);
            }
        }
        
        // Remove all matched delegations
        for key in keys_to_remove {
            store.remove(&key);
        }
        
        // Return success even if no delegations were found/modified
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

/// Retrieve detailed market resolution information (admin only)
/// 
/// This function returns comprehensive details about how a market was resolved,
/// including payout calculations, fee processing, and distribution information.
/// It is restricted to admin access only due to the sensitive financial information contained.
/// 
/// # Parameters
/// * `market_id` - The ID of the market to retrieve resolution details for
/// 
/// # Returns
/// * `Result<Option<MarketResolutionDetails>, String>` - The resolution details if found, or an error if unauthorized
#[query]
pub fn get_market_resolution_details(market_id: u64) -> Result<Option<MarketResolutionDetails>, String> {
    // Check caller is admin
    if !crate::controllers::admin::is_admin(ic_cdk::caller()) {
        return Err("Unauthorized: caller is not an admin".to_string());
    }
    
    // Convert market_id to our type system
    let market_id = MarketId::from(market_id);
    
    // Retrieve market resolution details from storage
    let details = crate::storage::get_market_resolution_details(&market_id);
    
    Ok(details)
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
