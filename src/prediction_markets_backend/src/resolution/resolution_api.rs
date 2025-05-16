//! # Resolution Public API 
//!
//! This module provides the public API endpoints for the resolution system.
//! It maintains backward compatibility with existing client applications
//! while delegating to the more specialized implementation modules.

use crate::resolution::resolution_proposal;
use crate::types::{MarketId, OutcomeIndex};
use crate::resolution::resolution::ResolutionResult;

/// Resolve the market through admin decision (public API endpoint)
///
/// This is a public API endpoint that aliases to the propose_resolution function, maintaining
/// backward compatibility while ensuring the dual approval system is followed.
///
/// For admin-created markets: immediate resolution by any admin
/// For user-created markets: requires dual approval between creator and admin
///
/// # Parameters
/// * `market_id` - ID of the market to resolve
/// * `winning_outcomes` - Vector of outcome indices that won
///
/// # Returns
/// * `ResolutionResult` - Success, waiting state, or error reason if the resolution fails
///
/// # Security
/// Only market creators and admins can call this function successfully.
// Note: #[update] attribute removed to avoid conflict with the original function in dual_approval.rs
pub async fn resolve_via_admin(
    market_id: MarketId, 
    winning_outcomes: Vec<OutcomeIndex>
) -> ResolutionResult {
    // This function is now just a wrapper around propose_resolution
    // for backward compatibility
    resolution_proposal::propose_resolution(market_id, winning_outcomes).await
}

/// Re-export the propose_resolution function to maintain a consistent API
pub async fn propose_resolution(
    market_id: MarketId, 
    winning_outcomes: Vec<OutcomeIndex>
) -> ResolutionResult {
    // Forward to the implementation in resolution_proposal
    resolution_proposal::propose_resolution(market_id, winning_outcomes).await
}

// Re-export the force_resolve_market and void_market functions
// to maintain the same public API surface
pub use crate::resolution::resolution_actions::{
    force_resolve_market,
    void_market
};
