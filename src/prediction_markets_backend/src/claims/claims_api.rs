//! # Claims API Module
//! 
//! This module provides the public API endpoints for the claims system, allowing
//! users to view and process their claims for market winnings or refunds.

use candid::Principal;
use ic_cdk::{query, update};

use crate::types::{MarketId, TokenAmount, TokenIdentifier};
use crate::controllers::admin::is_admin;
use crate::claims::claims_types::*;
use crate::claims::claims_storage::*;
use crate::claims::claims_processing::*;
use crate::canister::get_current_time;

/// Get all claims for the calling user
#[query]
pub fn get_user_claims(principal: String) -> Vec<ClaimRecord> {
    let user = Principal::from_text(principal).unwrap();
    fetch_user_claims(user)
}

/// Get pending claims for the calling user
#[query]
pub fn get_user_pending_claims(principal: String) -> Vec<ClaimRecord> {
    let user = Principal::from_text(principal).unwrap();
    fetch_user_pending_claims(user)
}

/// Get a summary of claimable amounts by token for the calling user
#[query]
pub fn get_claimable_summary() -> ClaimableSummary {
    let user = ic_cdk::caller();
    calculate_claimable_summary(user)
}

/// Claim winnings for one or more markets
#[update]
pub async fn claim_winnings(claim_ids: Vec<u64>) -> BatchClaimResult {
    process_claims(claim_ids).await
}

/// Get claims for a specific market (admin only)
#[query]
pub fn get_market_claims(market_id: MarketId) -> Vec<ClaimRecord> {
    // Check if caller is admin
    if !is_admin(ic_cdk::caller()) {
        return Vec::new();
    }
    
    fetch_market_claims(market_id)
}

/// Get a specific claim by ID
#[query]
pub fn get_claim_by_id(claim_id: u64) -> Option<ClaimRecord> {
    let claim = get_claim(claim_id);
    
    // Only allow retrieval if caller is claim owner or admin
    if let Some(claim_record) = &claim {
        if claim_record.user == ic_cdk::caller() || is_admin(ic_cdk::caller()) {
            return claim;
        }
        return None;
    }
    
    None
}

/// Retry a failed claim (callable by claim owner or admin)
#[update]
pub async fn retry_claim(claim_id: u64) -> ClaimResult {
    let claim = match get_claim(claim_id) {
        Some(c) => c,
        None => return ClaimResult {
            claim_id,
            success: false,
            block_index: None,
            error: Some("Claim not found".to_string()),
        }
    };
    
    // Check permissions - only claim owner or admin can retry
    if claim.user != ic_cdk::caller() && !is_admin(ic_cdk::caller()) {
        return ClaimResult {
            claim_id,
            success: false,
            block_index: None,
            error: Some("Not authorized to retry this claim".to_string()),
        };
    }
    
    retry_failed_claim(claim_id).await
}

/// Create a claim for testing purposes (admin only)
#[update]
pub fn create_test_claim(
    user: Principal,
    market_id: MarketId,
    amount: TokenAmount,
    token_id: TokenIdentifier
) -> u64 {
    if !is_admin(ic_cdk::caller()) {
        ic_cdk::trap("Only admins can create test claims");
    }
    
    let claim_type = ClaimType::Other {
        description: "Test claim created by admin".to_string(),
    };
    
    let timestamp = crate::canister::Timestamp::from(get_current_time());
    
    create_claim(
        user,
        market_id,
        claim_type,
        amount,
        token_id,
        timestamp
    )
}

/// Mark a claim as processed without transferring tokens (admin only)
/// This is useful for manual resolution of claims that were handled outside the system
#[update]
pub fn mark_claim_processed(claim_id: u64) -> bool {
    if !is_admin(ic_cdk::caller()) {
        return false;
    }
    
    // We only need to verify the claim exists, but don't need the actual claim data
    let _claim = match get_claim(claim_id) {
        Some(c) => c,
        None => return false,
    };
    
    let process_details = ProcessDetails {
        timestamp: crate::canister::get_current_time(),
        transaction_id: None, // No transaction ID as no transfer was made
    };
    
    update_claim_status(claim_id, ClaimStatus::Processed(process_details))
}

/// Get claims stats for the entire system (admin only)
#[query]
pub fn get_claims_stats() -> ClaimsStats {
    if !is_admin(ic_cdk::caller()) {
        return ClaimsStats::default();
    }
    
    // This is inefficient but provides a complete picture for admins
    // In a production system with many claims, this would need pagination or optimization
    let mut stats = ClaimsStats::default();
    
    CLAIMS.with(|claims| {
        for (_, claim) in claims.borrow().iter() {
            match claim.status {
                ClaimStatus::Pending => stats.pending_count += 1,
                ClaimStatus::Processed(_) => stats.processed_count += 1,
                ClaimStatus::Failed(_) => stats.failed_count += 1,
            }
            
            stats.total_count += 1;
            
            // Update token amounts
            stats.total_amount_by_token
                .entry(claim.token_id.clone())
                .and_modify(|amount| *amount = amount.clone() + claim.claimable_amount.clone())
                .or_insert(claim.claimable_amount.clone());
        }
    });
    
    stats
}

/// System-wide claims statistics (for admin use)
#[derive(candid::CandidType, serde::Serialize, serde::Deserialize, Clone, Debug, Default)]
pub struct ClaimsStats {
    /// Total number of claims in the system
    pub total_count: u64,
    /// Number of pending claims
    pub pending_count: u64,
    /// Number of processed claims
    pub processed_count: u64,
    /// Number of failed claims
    pub failed_count: u64,
    /// Total amount by token across all claims
    pub total_amount_by_token: std::collections::HashMap<TokenIdentifier, TokenAmount>,
}
