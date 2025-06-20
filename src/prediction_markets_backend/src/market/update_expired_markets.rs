use crate::market::market::*;
use crate::storage::MARKETS;
use crate::types::StorableNat;
use ic_cdk::{heartbeat, update};
use std::sync::atomic::{AtomicU64, Ordering};

/// Track the last time we checked for expired markets
static LAST_EXPIRY_CHECK: AtomicU64 = AtomicU64::new(0);

/// How frequently to check for expired markets (in nanoseconds)
/// Default is every 60 seconds
const EXPIRY_CHECK_INTERVAL_NS: u64 = 60_000_000_000;

/// Heartbeat function that periodically checks for expired markets
/// This is called automatically by the Internet Computer
#[heartbeat]
fn check_expired_markets() {
    let now = ic_cdk::api::time();
    let last_check = LAST_EXPIRY_CHECK.load(Ordering::Relaxed);

    // Only check if enough time has passed since the last check
    if now - last_check < EXPIRY_CHECK_INTERVAL_NS {
        return;
    }

    // Update the last check timestamp
    LAST_EXPIRY_CHECK.store(now, Ordering::Relaxed);

    // Log that we're checking for expired markets
    ic_cdk::println!("Checking for expired markets at {}", now);
    let (expired_markets, dropped_markets) = update_expired_markets_impl(now);
    if expired_markets > 0 {
        ic_cdk::println!("Updated {} markets to ExpiredUnresolved status", expired_markets);
    }
    if dropped_markets > 0 {
        ic_cdk::println!("Dropped {} markets", dropped_markets);
    }
}

/// Manual trigger for checking expired markets
/// This can be called by admins if needed
#[update]
pub fn update_expired_markets() -> u64 {
    let now = ic_cdk::api::time();
    let (expired_markets, dropped_markets) = update_expired_markets_impl(now);

    // Reset the last check timestamp
    LAST_EXPIRY_CHECK.store(now, Ordering::Relaxed);

    // Return the number of markets that were updated
    expired_markets + dropped_markets
}

fn update_expired_markets_impl(now: u64) -> (u64, u64) {
    let mut expired_markets: u64 = 0;
    let mut dropped_markets: u64 = 0;

    MARKETS.with(|markets| {
        let mut markets_ref = markets.borrow_mut();
        
        // First, collect the markets that need to be updated
        let mut markets_to_update = Vec::new();
        // Second, collect the markets that need to be dropped
        let mut markets_to_be_dropped = Vec::new();

        for (id, market) in markets_ref.iter() {
            // Check if the market is active and has passed its end time
            let pending_end_time = std::cmp::min(market.created_at.to_u64() + 60 * 60 * 1_000_000_000u64, market.end_time.to_u64());
            if market.status == MarketStatus::PendingActivation && now >= pending_end_time {
                markets_to_be_dropped.push(id);
            } else if market.status == MarketStatus::Active && now >= market.end_time.to_u64() {
                // Store the market ID and a clone with updated status
                let mut updated_market = market.clone();
                updated_market.status = MarketStatus::ExpiredUnresolved;
                markets_to_update.push((StorableNat::from(market.id.clone()), updated_market));
            }
        }

        expired_markets = markets_to_update.len() as u64;
        // Now update all the markets that need updating
        for (id, updated_market) in markets_to_update {
            markets_ref.insert(id, updated_market);
        }

        dropped_markets = markets_to_be_dropped.len() as u64;
        // Now drop all the markets that need dropping
        for id in markets_to_be_dropped {
            markets_ref.remove(&id);
        }
    });

    (expired_markets, dropped_markets)
}
