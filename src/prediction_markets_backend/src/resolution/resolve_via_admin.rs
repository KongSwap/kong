use ic_cdk::update;

use super::finalize_market::*;
use super::resolution::*;

use crate::controllers::admin::*;
use crate::nat::*;
use crate::stable_memory::*;

/// Resolves a market through admin decision
#[update]
async fn resolve_via_admin(market_id: MarketId, outcome_indices: Vec<StorableNat>) -> Result<(), ResolutionError> {
    // Validate outcome indices are not empty
    if outcome_indices.is_empty() {
        return Err(ResolutionError::InvalidOutcome);
    }
    let admin = ic_cdk::caller();

    // Verify the caller is an admin
    if !is_admin(admin) {
        return Err(ResolutionError::Unauthorized);
    }

    // Get market and validate state
    let mut market = MARKETS.with(|markets| {
        let markets_ref = markets.borrow();
        markets_ref.get(&market_id).ok_or(ResolutionError::MarketNotFound)
    })?;

    // Set the admin who resolved the market
    market.resolved_by = Some(admin);

    // Verify resolution method is Admin
    match market.resolution_method {
        ResolutionMethod::Admin => {}
        _ => return Err(ResolutionError::InvalidMethod),
    }

    // Verify market has ended
    if ic_cdk::api::time() < market.end_time {
        return Err(ResolutionError::MarketStillOpen);
    }

    // Finalize the market with the chosen outcomes
    finalize_market(&mut market, outcome_indices).await?;

    // Update market in storage
    MARKETS.with(|markets| {
        let mut markets_ref = markets.borrow_mut();
        markets_ref.insert(market_id, market);
    });

    Ok(())
}
