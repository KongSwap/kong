use ic_cdk::query;
use candid::CandidType;
use serde::Deserialize;

use super::market::*;
use super::query_utils::{MarketFilter, MarketTransformer};

use crate::nat::*;
use crate::stable_memory::*;

#[derive(CandidType, Deserialize)]
pub struct GetMarketsByStatusArgs {
    pub start: StorableNat,
    pub length: StorableNat,
}

#[derive(CandidType, Deserialize)]
pub struct GetMarketsByStatusResult {
    pub markets_by_status: MarketsByStatus,
    pub total_active: StorableNat,
    pub total_expired_unresolved: StorableNat,
    pub total_resolved: StorableNat,
}

/// Get markets grouped by their status: active, expired but unresolved, and resolved
/// with pagination support
#[query]
pub fn get_markets_by_status(args: GetMarketsByStatusArgs) -> GetMarketsByStatusResult {
    let now = ic_cdk::api::time();
    let transformer = MarketTransformer::new();

    // Get all markets
    let all_markets = MARKETS.with(|markets| {
        markets.borrow().iter().collect::<Vec<_>>()
    });

    // Calculate status statistics for all markets
    let (total_active, total_expired_unresolved, total_resolved) = 
        transformer.calculate_markets_by_status_stats(&all_markets);

    // Create result structure
    let mut result = MarketsByStatus {
        active: Vec::new(),
        expired_unresolved: Vec::new(),
        resolved: Vec::new(),
    };

    // Filter and transform markets by each status group
    let active_markets = MarketFilter::new()
        .with_statuses(vec![MarketStatus::Active, MarketStatus::Pending])
        .apply(all_markets.clone())
        .into_iter()
        .filter(|(_, market)| now < market.end_time.to_u64())
        .collect::<Vec<_>>();

    let expired_unresolved_markets = all_markets.clone()
        .into_iter()
        .filter(|(_, market)| {
            match market.status {
                MarketStatus::Active | MarketStatus::Pending => {
                    now >= market.end_time.to_u64()
                },
                MarketStatus::Disputed => true,
                _ => false
            }
        })
        .collect::<Vec<_>>();

    let resolved_markets = all_markets
        .into_iter()
        .filter(|(_, market)| {
            match market.status {
                MarketStatus::Closed(_) | MarketStatus::Voided => true,
                _ => false
            }
        })
        .collect::<Vec<_>>();

    // Transform active markets
    for (market_id, market) in active_markets {
        result.active.push(transformer.transform_market(market_id, &market));
    }

    // Transform expired but unresolved markets
    for (market_id, market) in expired_unresolved_markets {
        result.expired_unresolved.push(transformer.transform_market(market_id, &market));
    }

    // Transform resolved markets
    for (market_id, market) in resolved_markets {
        if let MarketStatus::Voided = market.status {
            // For voided markets, create an empty market result
            result.resolved.push(MarketResult {
                market: market.clone(),
                winning_outcomes: Vec::new(),
                total_pool: StorableNat::from(0u64),
                winning_pool: StorableNat::from(0u64),
                outcome_pools: vec![StorableNat::from(0u64); market.outcomes.len()],
                outcome_percentages: vec![0.0; market.outcomes.len()],
                bet_counts: vec![StorableNat::from(0u64); market.outcomes.len()],
                bet_count_percentages: vec![0.0; market.outcomes.len()],
                distributions: Vec::new(),
            });
        } else {
            // For closed markets, calculate detailed market result
            result.resolved.push(transformer.transform_to_market_result(market_id, &market));
        }
    }

    // Apply pagination
    if !args.start.is_zero() || !args.length.is_zero() {
        let start = args.start.to_u64() as usize;
        let length = args.length.to_u64() as usize;

        if length > 0 {
            // Apply pagination to each category
            if start < result.active.len() {
                let end = std::cmp::min(start + length, result.active.len());
                result.active = result.active[start..end].to_vec();
            } else {
                result.active = Vec::new();
            }

            if start < result.expired_unresolved.len() {
                let end = std::cmp::min(start + length, result.expired_unresolved.len());
                result.expired_unresolved = result.expired_unresolved[start..end].to_vec();
            } else {
                result.expired_unresolved = Vec::new();
            }

            if start < result.resolved.len() {
                let end = std::cmp::min(start + length, result.resolved.len());
                result.resolved = result.resolved[start..end].to_vec();
            } else {
                result.resolved = Vec::new();
            }
        }
    }

    GetMarketsByStatusResult {
        markets_by_status: result,
        total_active: StorableNat::from(total_active as u64),
        total_expired_unresolved: StorableNat::from(total_expired_unresolved as u64),
        total_resolved: StorableNat::from(total_resolved as u64),
    }
}
