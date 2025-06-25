//! # Resolution Proposal API
//!
//! This module provides public API endpoints for querying resolution proposal
//! information and voting status for dual-approval markets.

use ic_cdk::query;
use crate::resolution::resolution::{ResolutionProposalInfo, ResolutionProposalStatus};
use crate::storage::RESOLUTION_PROPOSALS;
use crate::types::MarketId;

/// Get resolution proposal information for a specific market
///
/// Returns detailed information about the current resolution proposal for a market,
/// including votes cast by creator and admin, current status, and timestamps.
///
/// # Parameters
/// * `market_id` - The ID of the market to query
///
/// # Returns
/// * `Option<ResolutionProposalInfo>` - Proposal information if it exists, None otherwise
#[query]
pub fn get_resolution_proposal(market_id: MarketId) -> Option<ResolutionProposalInfo> {
    RESOLUTION_PROPOSALS.with(|proposals| {
        let proposals_ref = proposals.borrow();
        proposals_ref.get(&market_id).map(|proposal| proposal.to_info())
    })
}

/// Get all currently active resolution proposals
///
/// Returns a list of all markets that have active resolution proposals,
/// regardless of their status. Useful for admin dashboards and monitoring.
///
/// # Returns
/// * `Vec<ResolutionProposalInfo>` - List of all active resolution proposals
#[query]
pub fn get_active_resolution_proposals() -> Vec<ResolutionProposalInfo> {
    RESOLUTION_PROPOSALS.with(|proposals| {
        let proposals_ref = proposals.borrow();
        proposals_ref.iter()
            .map(|(_, proposal)| proposal.to_info())
            .collect()
    })
}

/// Get resolution proposals filtered by their current status
///
/// Returns proposals that match the specified status, allowing clients to
/// query for specific states like "awaiting admin vote" or "votes disagree".
///
/// # Parameters
/// * `status` - The status to filter by
///
/// # Returns
/// * `Vec<ResolutionProposalInfo>` - List of proposals matching the status
#[query]
pub fn get_resolution_proposals_by_status(status: ResolutionProposalStatus) -> Vec<ResolutionProposalInfo> {
    RESOLUTION_PROPOSALS.with(|proposals| {
        let proposals_ref = proposals.borrow();
        proposals_ref.iter()
            .filter_map(|(_, proposal)| {
                let info = proposal.to_info();
                if info.status == status {
                    Some(info)
                } else {
                    None
                }
            })
            .collect()
    })
} 