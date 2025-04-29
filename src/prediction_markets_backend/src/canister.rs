use candid::{CandidType, Deserialize, Principal};
use ic_cdk::{caller, query, update};
use ic_cdk::api::time;
use std::cell::RefCell;
use std::collections::BTreeMap;
use icrc_ledger_types::icrc21::errors::ErrorInfo;
use icrc_ledger_types::icrc21::requests::{ConsentMessageRequest, ConsentMessageMetadata};
use icrc_ledger_types::icrc21::responses::{ConsentInfo, ConsentMessage};
use candid::decode_one;

use super::delegation::*;
use super::market::create_market::*;
use super::market::get_market::*;
use super::market::get_market_by_status::*;
use super::market::get_stats::*;
use super::market::market::*;
use super::market::estimate_return_types::*;
use super::nat::*;
use super::stable_memory::*;

// Helper function to get current time in nanoseconds
pub fn get_current_time() -> u64 {
    time()
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
        created: current_time,
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
    current_time: u64
) -> EstimatedReturn {
    let market_id = StorableNat::from(market_id);
    let outcome_index = StorableNat::from(outcome_index);
    let bet_amount = StorableNat::from(bet_amount);
    let current_time = StorableNat::from(current_time);
    
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
                        current_market_pool: StorableNat::from(0u64),
                        current_outcome_pool: StorableNat::from(0u64),
                        scenarios: vec![],
                        uses_time_weighting: false,
                        time_weight_alpha: None,
                        current_time,
                    }
                }
            }
        } else {
            // Return a default estimate if market not found
            EstimatedReturn {
                market_id,
                outcome_index,
                bet_amount,
                current_market_pool: StorableNat::from(0u64),
                current_outcome_pool: StorableNat::from(0u64),
                scenarios: vec![],
                uses_time_weighting: false,
                time_weight_alpha: None,
                current_time,
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
    let market_id = StorableNat::from(market_id);
    
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
    let market_id = StorableNat::from(market_id);
    let bet_time = StorableNat::from(bet_time);
    let future_time = StorableNat::from(future_time);
    
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
    static MARKET_PAYOUTS: RefCell<BTreeMap<StorableNat, Vec<BetPayoutRecord>>> = 
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
pub fn get_market_payout_records(market_id: u64) -> Vec<BetPayoutRecord> {
    let market_id = StorableNat::from(market_id);
    
    MARKET_PAYOUTS.with(|payouts| {
        let payouts = payouts.borrow();
        if let Some(market_payouts) = payouts.get(&market_id) {
            market_payouts.clone()
        } else {
            vec![]
        }
    })
}
