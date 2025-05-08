use super::resolution::*;
use super::dual_approval;
use crate::types::{MarketId, OutcomeIndex};

/// Resolves a market through admin decision
/// This is now a wrapper around the dual approval system
/// Note: The actual #[update] function is defined in dual_approval.rs
#[allow(dead_code)]
async fn resolve_via_admin(market_id: MarketId, outcome_indices: Vec<OutcomeIndex>) -> Result<(), ResolutionError> {
    // Use the dual approval implementation
    dual_approval::resolve_via_admin(market_id, outcome_indices).await
}
