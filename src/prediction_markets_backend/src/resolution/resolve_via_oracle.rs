use candid::Principal;
use ic_cdk::update;
use num_traits::ToPrimitive;

use super::finalize_market::*;
use super::resolution::*;

use crate::nat::*;
use crate::stable_memory::*;

/// Resolves a market through oracle confirmation
#[update]
async fn resolve_via_oracle(market_id: MarketId, outcome_indices: Vec<StorableNat>, _signature: Vec<u8>) -> Result<(), ResolutionError> {
    let oracle_principal = ic_cdk::caller();

    // Verify oracle is whitelisted
    if !ORACLES.with(|o| o.borrow().contains_key(&oracle_principal)) {
        return Err(ResolutionError::Unauthorized);
    }

    // Get market and validate state
    let mut market = MARKETS.with(|markets| {
        let markets_ref = markets.borrow();
        markets_ref.get(&market_id).ok_or(ResolutionError::MarketNotFound)
    })?;

    // Verify oracle is authorized for this market
    match &market.resolution_method {
        ResolutionMethod::Oracle {
            oracle_principals,
            required_confirmations,
        } => {
            if !oracle_principals.contains(&oracle_principal) {
                return Err(ResolutionError::Unauthorized);
            }

            // Track oracle confirmations
            let mut confirmations = market
                .resolution_data
                .as_ref()
                .and_then(|d| serde_json::from_str::<Vec<Principal>>(d).ok())
                .unwrap_or_default();

            if !confirmations.contains(&oracle_principal) {
                confirmations.push(oracle_principal);
                market.resolution_data = Some(serde_json::to_string(&confirmations).unwrap());
            }

            // If enough confirmations, finalize the market
            if confirmations.len() >= required_confirmations.0.to_u64().unwrap_or(0) as usize {
                finalize_market(&mut market, outcome_indices).await?;
            }
        }
        _ => return Err(ResolutionError::InvalidMethod),
    }

    // Update market in storage
    MARKETS.with(|markets| {
        let mut markets_ref = markets.borrow_mut();
        markets_ref.insert(market_id, market);
    });

    Ok(())
}
