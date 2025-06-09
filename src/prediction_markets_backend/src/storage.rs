//! Storage Module - An interface to the stable memory system
//!
//! This module provides direct access to the stable memory variables and serves as
//! a compatibility layer between the original code and the stable memory implementation.
//! It defines thread-local variables for transient state and proxy functions to access
//! the stable memory storage.

use crate::types::{MarketId, MarketResolutionDetails};
use crate::bet::bet::Bet;
use std::cell::RefCell;
use std::collections::HashMap;

// Re-export stable memory variables with the names expected in the rest of the codebase
pub use crate::stable_memory::STABLE_MARKETS as MARKETS;
pub use crate::stable_memory::STABLE_BETS as BETS;
pub use crate::stable_memory::FEE_BALANCE;
pub use crate::stable_memory::STABLE_RESOLUTION_PROPOSALS as RESOLUTION_PROPOSALS;
pub use crate::stable_memory::STABLE_DELEGATIONS as DELEGATIONS;
pub use crate::stable_memory::STABLE_ORACLE_WHITELIST as ORACLES;

// Thread-local storage for the next market ID
thread_local! {
    /// Counter for the next market ID to be assigned
    /// This ensures every market gets a unique sequential ID
    pub static NEXT_MARKET_ID: RefCell<u64> = RefCell::new(1);
    
    /// Storage for market resolution details with market ID as key
    /// This captures comprehensive information about how markets were resolved
    pub static MARKET_RESOLUTION_DETAILS: RefCell<HashMap<MarketId, MarketResolutionDetails>> = RefCell::new(HashMap::new());
}

/// Retrieves all bets for a given market ID
/// 
/// This helper function collects all bets associated with a specific market ID from the
/// stable memory storage. It handles the conversion from (MarketId, u64) keyed storage
/// to a simple Vec<Bet> for easier processing.
/// 
/// # Parameters
/// * `market_id` - The ID of the market to retrieve bets for
/// 
/// # Returns
/// * `Vec<Bet>` - Collection of all bets placed on the specified market
pub fn get_bets_for_market(market_id: &MarketId) -> Vec<Bet> {
    BETS.with(|bets| {
        let bets = bets.borrow();
        let mut market_bets = Vec::new();
        
        // Iterate through all bets and collect those matching our market ID
        // The stable memory interface doesn't have a direct "get by partial key" functionality
        for (bet_key, bet) in bets.iter() {
            if &bet_key.market_id == market_id {
                market_bets.push(bet.clone());
            }
        }
        
        market_bets
    })
}

/// Get current next market ID
pub fn get_next_market_id() -> u64 {
    NEXT_MARKET_ID.with(|counter| *counter.borrow())
}

/// Set next market ID (used during canister upgrade)
pub fn set_next_market_id(id: u64) {
    NEXT_MARKET_ID.with(|next_id| {
        *next_id.borrow_mut() = id;
    });
}

/// Store market resolution details
/// 
/// Records comprehensive information about how a market was resolved,
/// including payout calculations, fee processing, and distribution details.
/// 
/// # Parameters
/// * `details` - The resolution details to store
pub fn store_market_resolution_details(details: MarketResolutionDetails) {
    MARKET_RESOLUTION_DETAILS.with(|details_map| {
        details_map.borrow_mut().insert(details.market_id.clone(), details);
    });
}

/// Retrieve market resolution details
/// 
/// Fetches the stored resolution details for a specific market.
/// 
/// # Parameters
/// * `market_id` - The ID of the market to retrieve details for
/// 
/// # Returns
/// * `Option<MarketResolutionDetails>` - The resolution details if found, None otherwise
pub fn get_market_resolution_details(market_id: &MarketId) -> Option<MarketResolutionDetails> {
    MARKET_RESOLUTION_DETAILS.with(|details_map| {
        details_map.borrow().get(market_id).cloned()
    })
}
