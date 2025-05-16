//! # Claims Storage Module
//! 
//! This module provides persistent storage for claim records using the canister's stable memory.
//! It manages the creation, retrieval, and updating of claim records throughout their lifecycle.

use candid::Principal;
use std::cell::RefCell;
use std::collections::HashMap;

use crate::types::{MarketId, TokenAmount, TokenIdentifier};
use crate::canister::get_current_time;
use crate::canister::Timestamp;
use crate::claims::claims_types::*;

// Thread-local stable storage for claims
thread_local! {
    // Main claims storage, keyed by claim_id
    pub static CLAIMS: RefCell<HashMap<u64, ClaimRecord>> = RefCell::new(HashMap::new());
    
    // Index of claims by user for efficient retrieval
    static USER_CLAIMS: RefCell<HashMap<Principal, Vec<u64>>> = RefCell::new(HashMap::new());
    
    // Index of claims by market for efficient retrieval
    static MARKET_CLAIMS: RefCell<HashMap<MarketId, Vec<u64>>> = RefCell::new(HashMap::new());
    
    // Counter for generating unique claim IDs
    static NEXT_CLAIM_ID: RefCell<u64> = RefCell::new(1);
}

/// Gets the next unique claim ID
fn get_next_claim_id() -> u64 {
    NEXT_CLAIM_ID.with(|counter| {
        let current_id = *counter.borrow();
        counter.replace(current_id + 1);
        current_id
    })
}

/// Creates a new claim record
pub fn create_claim(
    user: Principal,
    market_id: MarketId,
    claim_type: ClaimType,
    claimable_amount: TokenAmount,
    token_id: TokenIdentifier,
    timestamp: Timestamp,
) -> u64 {
    let claim_id = get_next_claim_id();
    
    let claim = ClaimRecord {
        claim_id,
        user,
        market_id: market_id.clone(),
        claim_type,
        claimable_amount,
        token_id,
        status: ClaimStatus::Pending,
        created_at: timestamp.clone(),
        updated_at: timestamp.clone(),
    };
    
    // Store the claim
    CLAIMS.with(|claims| {
        claims.borrow_mut().insert(claim_id, claim);
    });
    
    // Update the user index
    USER_CLAIMS.with(|user_claims| {
        let mut map = user_claims.borrow_mut();
        map.entry(user).or_insert_with(Vec::new).push(claim_id);
    });
    
    // Update the market index
    MARKET_CLAIMS.with(|market_claims| {
        let mut map = market_claims.borrow_mut();
        map.entry(market_id).or_insert_with(Vec::new).push(claim_id);
    });
    
    claim_id
}

/// Gets a specific claim by ID
pub fn get_claim(claim_id: u64) -> Option<ClaimRecord> {
    CLAIMS.with(|claims| {
        claims.borrow().get(&claim_id).cloned()
    })
}

/// Updates the status of a claim
pub fn update_claim_status(claim_id: u64, new_status: ClaimStatus) -> bool {
    CLAIMS.with(|claims| {
        let mut claims_map = claims.borrow_mut();
        
        if let Some(claim) = claims_map.get_mut(&claim_id) {
            claim.status = new_status;
            claim.updated_at = Timestamp::from(get_current_time());
            true
        } else {
            false
        }
    })
}

/// Gets all claims for a specific user
pub fn get_user_claims(user: Principal) -> Vec<ClaimRecord> {
    let claim_ids = USER_CLAIMS.with(|user_claims| {
        user_claims.borrow().get(&user).cloned().unwrap_or_default()
    });
    
    CLAIMS.with(|claims| {
        let claims_map = claims.borrow();
        claim_ids.iter()
            .filter_map(|id| claims_map.get(id).cloned())
            .collect()
    })
}

/// Renamed function for API usage - Gets all claims for a specific user
pub fn fetch_user_claims(user: Principal) -> Vec<ClaimRecord> {
    get_user_claims(user)
}

/// Gets pending claims for a specific user
pub fn get_user_pending_claims(user: Principal) -> Vec<ClaimRecord> {
    get_user_claims(user).into_iter()
        .filter(|claim| matches!(claim.status, ClaimStatus::Pending))
        .collect()
}

/// Renamed function for API usage - Gets pending claims for a specific user
pub fn fetch_user_pending_claims(user: Principal) -> Vec<ClaimRecord> {
    get_user_pending_claims(user)
}

/// Gets all claims for a specific market
pub fn get_market_claims(market_id: MarketId) -> Vec<ClaimRecord> {
    let claim_ids = MARKET_CLAIMS.with(|market_claims| {
        market_claims.borrow().get(&market_id).cloned().unwrap_or_default()
    });
    
    CLAIMS.with(|claims| {
        let claims_map = claims.borrow();
        claim_ids.iter()
            .filter_map(|id| claims_map.get(id).cloned())
            .collect()
    })
}

/// Renamed function for API usage - Gets all claims for a specific market
pub fn fetch_market_claims(market_id: MarketId) -> Vec<ClaimRecord> {
    get_market_claims(market_id)
}

/// Gets a summary of claimable amounts by token for a user
pub fn get_claimable_summary(user: Principal) -> ClaimableSummary {
    let pending_claims = get_user_pending_claims(user);
    
    let mut by_token: HashMap<TokenIdentifier, TokenAmount> = HashMap::new();
    let pending_claim_count = pending_claims.len() as u64;
    
    for claim in pending_claims {
        by_token.entry(claim.token_id.clone())
            .and_modify(|total| *total = total.clone() + claim.claimable_amount.clone())
            .or_insert(claim.claimable_amount);
    }
    
    ClaimableSummary {
        by_token,
        pending_claim_count,
    }
}

/// Renamed function for API usage - Gets a summary of claimable amounts by token for a user
pub fn calculate_claimable_summary(user: Principal) -> ClaimableSummary {
    get_claimable_summary(user)
}

/// Exports all claims data for stable memory persistence
pub fn export_claims() -> (
    HashMap<u64, ClaimRecord>,
    HashMap<Principal, Vec<u64>>,
    HashMap<MarketId, Vec<u64>>,
    u64
) {
    let claims = CLAIMS.with(|c| c.borrow().clone());
    let user_claims = USER_CLAIMS.with(|uc| uc.borrow().clone());
    let market_claims = MARKET_CLAIMS.with(|mc| mc.borrow().clone());
    let next_id = NEXT_CLAIM_ID.with(|id| *id.borrow());
    
    (claims, user_claims, market_claims, next_id)
}

/// Imports claims data from stable memory
pub fn import_claims(
    claims: HashMap<u64, ClaimRecord>,
    user_claims: HashMap<Principal, Vec<u64>>,
    market_claims: HashMap<MarketId, Vec<u64>>,
    next_id: u64
) {
    CLAIMS.with(|c| *c.borrow_mut() = claims);
    USER_CLAIMS.with(|uc| *uc.borrow_mut() = user_claims);
    MARKET_CLAIMS.with(|mc| *mc.borrow_mut() = market_claims);
    NEXT_CLAIM_ID.with(|id| *id.borrow_mut() = next_id);
}
