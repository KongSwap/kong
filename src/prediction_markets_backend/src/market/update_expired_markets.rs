use ic_cdk::{update, heartbeat};
use std::sync::atomic::{AtomicU64, Ordering};
use crate::market::market::*;
use crate::token::registry::*;
use crate::stable_memory::MARKETS;
use crate::types::StorableNat;

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
    
    // Get all active markets and check if they've expired
    MARKETS.with(|markets| {
        let mut markets_ref = markets.borrow_mut();
        let mut expired_markets = 0;
        
        // First, collect the markets that need to be updated
        let mut markets_to_update = Vec::new();
        
        for (_id, market) in markets_ref.iter() {
            // Check if the market is active and has passed its end time
            if (market.status == MarketStatus::Active || market.status == MarketStatus::PendingActivation) 
                && now >= market.end_time.to_u64() {
                // Store the market ID and a clone with updated status
                let mut updated_market = market.clone();
                updated_market.status = MarketStatus::ExpiredUnresolved;
                markets_to_update.push((StorableNat::from(market.id.clone()), updated_market));
                expired_markets += 1;
            }
        }
        
        // Now update all the markets that need updating
        for (id, updated_market) in markets_to_update {
            markets_ref.insert(id, updated_market);
        }
        
        if expired_markets > 0 {
            ic_cdk::println!("Updated {} markets to ExpiredUnresolved status", expired_markets);
        }
    });
}

/// Manual trigger for checking expired markets
/// This can be called by admins if needed
#[update]
fn update_expired_markets() -> u64 {
    let now = ic_cdk::api::time();
    let mut expired_markets = 0;
    
    // Get all active markets and check if they've expired
    MARKETS.with(|markets| {
        let mut markets_ref = markets.borrow_mut();
        
        // First, collect the markets that need to be updated
        let mut markets_to_update = Vec::new();
        
        for (_id, market) in markets_ref.iter() {
            // Check if the market is active and has passed its end time
            if (market.status == MarketStatus::Active || market.status == MarketStatus::PendingActivation) 
                && now >= market.end_time.to_u64() {
                // Store the market ID and a clone with updated status
                let mut updated_market = market.clone();
                updated_market.status = MarketStatus::ExpiredUnresolved;
                markets_to_update.push((StorableNat::from(market.id.clone()), updated_market));
                expired_markets += 1;
            }
        }
        
        // Now update all the markets that need updating
        for (id, updated_market) in markets_to_update {
            markets_ref.insert(id, updated_market);
        }
    });
    
    // Reset the last check timestamp
    LAST_EXPIRY_CHECK.store(now, Ordering::Relaxed);
    
    // Return the number of markets that were updated
    expired_markets
}
