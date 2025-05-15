use super::resolution::*;
use super::resolution_api;
use crate::types::{MarketId, OutcomeIndex};

/// Resolves a market through admin decision
/// This is now a wrapper around the resolution API system
/// We use a different name to avoid collision with the function in dual_approval.rs
#[ic_cdk::update]
async fn admin_resolve_market(market_id: MarketId, outcome_indices: Vec<OutcomeIndex>) -> Result<(), ResolutionError> {
    // Use the resolution API implementation
    resolution_api::resolve_via_admin(market_id, outcome_indices).await
}
