//! # Stable Memory System
//! 
//! This module implements the persistence layer for the Kong Swap prediction markets platform,
//! ensuring all critical data survives canister upgrades and system restarts. It uses the
//! Internet Computer's stable memory system to maintain state across code upgrades.
//! 
//! The stable memory system stores:
//! - Markets with their complete configurations and states
//! - Bets placed by users on each market
//! - Resolution proposals for the dual approval system
//! - User delegations and oracle whitelist
//! 
//! Each data type is stored in a separate `StableBTreeMap` with its own memory region,
//! managed by a central memory manager that allocates virtual memory segments.

use candid::Principal;
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl, StableBTreeMap,
};
use std::cell::RefCell;

use super::delegation::*;

use crate::market::market::*;
use crate::resolution::resolution::ResolutionProposal;
use crate::types::{MarketId, MarketResolutionDetails};
use crate::claims::claims_storage;
use crate::storage::{NEXT_MARKET_ID, MARKET_RESOLUTION_DETAILS};
use std::collections::HashMap;

/// Type alias for the virtual memory used by stable collections
/// 
/// This is a virtual memory region backed by the Internet Computer's DefaultMemoryImpl,
/// which provides guaranteed persistence across canister upgrades.
pub type Memory = VirtualMemory<DefaultMemoryImpl>;

// Stable memory configuration for persistent data storage
thread_local! {
    /// Stable memory configuration using thread_local storage
    /// 
    /// These thread-local variables define the stable data structures that persist
    /// across canister upgrades. Each structure is allocated a specific memory region
    /// by the memory manager ensuring data isolation and integrity.
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
        MemoryManager::init(DefaultMemoryImpl::default())
    );
    
    /// Stable storage for claims data (used for upgrade persistence)
    /// 
    /// Storage for the in-memory claim state during upgrades
    /// This is used to persist claims, user_claims, market_claims, and next_claim_id
    /// Raw storage format: Option<(claims_vec, user_claims_vec, market_claims_vec, next_id)>
    pub static STABLE_CLAIMS_DATA: RefCell<Option<(
        Vec<(u64, crate::claims::claims_types::ClaimRecord)>,
        Vec<(Principal, Vec<u64>)>,
        Vec<(MarketId, Vec<u64>)>,
        u64
    )>> = RefCell::new(None);

    /// Storage for market resolution details during upgrades
    /// This stores detailed information about how markets were resolved
    /// Raw storage format: Vec<(MarketId, MarketResolutionDetails)>
    pub static STABLE_MARKET_RESOLUTION_DETAILS: RefCell<Option<Vec<(MarketId, MarketResolutionDetails)>>> = RefCell::new(None);

    /// Stable BTree map for markets indexed by MarketId
    pub static STABLE_MARKETS: RefCell<StableBTreeMap<MarketId, Market, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|mm| mm.borrow().get(MemoryId::new(0)))
        )
    );

    /// Stable BTree map for bets indexed by a composite key of MarketId + BetId
    pub static STABLE_BETS: RefCell<StableBTreeMap<crate::bet::bet::BetKey, crate::bet::bet::Bet, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|mm| mm.borrow().get(MemoryId::new(1)))
        )
    );

    /// Stable BTree map for resolution proposals indexed by MarketId
    pub static STABLE_RESOLUTION_PROPOSALS: RefCell<StableBTreeMap<MarketId, ResolutionProposal, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|mm| mm.borrow().get(MemoryId::new(2)))
        )
    );

    /// Stable BTree map for delegations indexed by Principal (delegator)
    pub static STABLE_DELEGATIONS: RefCell<StableBTreeMap<Principal, Delegation, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|mm| mm.borrow().get(MemoryId::new(3)))
        )
    );

    /// Stable set of oracle principals
    pub static STABLE_ORACLE_WHITELIST: RefCell<StableBTreeMap<Principal, bool, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|mm| mm.borrow().get(MemoryId::new(4)))
        )
    );
    
    // The claims data storage is already defined above

    /// Stores user token balances
    /// 
    /// This collection tracks token balances for each user, indexed by their Principal ID.
    /// Uses memory region 5 and is used for legacy token handling before the multi-token
    /// system was implemented. New markets use direct ledger transfers instead.
    pub static BALANCES: RefCell<StableBTreeMap<Principal, u64, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(5))),
        )
    );

    /// Stores the accumulated house fees
    /// 
    /// This collection tracks platform fees collected from markets, organized by token type.
    /// Uses memory region 6 and is primarily used for administrative accounting and
    /// fee withdrawal operations. For KONG tokens, fees are burned rather than collected.
    pub static FEE_BALANCE: RefCell<StableBTreeMap<Principal, u64, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(6))),
        )
    );
}

// A counter for the next market ID to be assigned
thread_local! {
    /// Counter for the next market ID to be assigned
    pub static STABLE_NEXT_MARKET_ID: RefCell<u64> = RefCell::new(1);
}

/// Saves the current state to stable memory before an upgrade
/// 
/// This function is automatically called before any canister upgrade through
/// the pre_upgrade hook in lib.rs. It prepares critical application state
/// for persistence across the upgrade process.
/// 
/// # Details
/// The stable BTree maps (markets, bets, etc.) handle their own serialization,
/// so this function focuses on persisting other in-memory data that isn't
/// already in stable storage, such as the claims system data and market resolution details.
pub fn save() {
    // Save claims data to stable storage
    let claims_data = crate::claims::claims_storage::export_claims();
    
    // Convert HashMaps to Vec<(K,V)> for stable storage
    let claims_vec: Vec<(u64, crate::claims::claims_types::ClaimRecord)> = claims_data.0.into_iter().collect();
    let user_claims_vec: Vec<(Principal, Vec<u64>)> = claims_data.1.into_iter().collect();
    let market_claims_vec: Vec<(MarketId, Vec<u64>)> = claims_data.2.into_iter().collect();
    
    STABLE_CLAIMS_DATA.with(|stable_claims| {
        *stable_claims.borrow_mut() = Some((claims_vec, user_claims_vec, market_claims_vec, claims_data.3));
    });
    
    // Save market resolution details to stable storage
    MARKET_RESOLUTION_DETAILS.with(|details_map| {
        let resolution_details_vec: Vec<(MarketId, MarketResolutionDetails)> = 
            details_map.borrow().iter().map(|(k, v)| (k.clone(), v.clone())).collect();
        
        STABLE_MARKET_RESOLUTION_DETAILS.with(|stable_details| {
            *stable_details.borrow_mut() = Some(resolution_details_vec);
        });
    });
}

/// Restores the stable memory state after a canister upgrade
/// 
/// This function is called by the post_upgrade hook in lib.rs and performs
/// necessary initialization after a canister code upgrade. While the stable memory
/// itself is automatically preserved, this function handles additional state
/// synchronization like setting the market ID counter.
/// 
/// # Details
/// 1. The stable memory structures (markets, bets, etc.) are automatically preserved
/// 2. The market ID counter is set to match the highest existing market ID to
///    ensure new markets receive unique, sequential IDs
/// 3. Claims data is restored from stable storage if available
/// 4. Any future migrations or state adjustments can be added to this function
/// 
/// # Usage
/// This should only be called from the post_upgrade hook in lib.rs
pub fn restore() {
    // We need to re-initialize the market ID counter to the highest existing market ID
    // Get the highest market ID from stable storage
    let highest_market_id = STABLE_MARKETS.with(|markets| {
        markets
            .borrow()
            .iter()
            .map(|(id, _)| id.clone())
            .max()
    });

    // Set the market ID counter to the highest market ID + 1 (or 1 if no markets exist)
    if let Some(max_id) = highest_market_id {
        NEXT_MARKET_ID.with(|id| {
            *id.borrow_mut() = max_id.to_u64() + 1;
        });
    } else {
        NEXT_MARKET_ID.with(|id| {
            *id.borrow_mut() = 1;
        });
    }
    
    // Restore claims data if available
    STABLE_CLAIMS_DATA.with(|stable_claims| {
        if let Some((claims_vec, user_claims_vec, market_claims_vec, next_id)) = stable_claims.borrow_mut().take() {
            // Convert Vec<(K,V)> back to HashMaps
            let claims: std::collections::HashMap<u64, crate::claims::claims_types::ClaimRecord> = claims_vec.into_iter().collect();
            let user_claims: std::collections::HashMap<Principal, Vec<u64>> = user_claims_vec.into_iter().collect();
            let market_claims: std::collections::HashMap<MarketId, Vec<u64>> = market_claims_vec.into_iter().collect();
            
            crate::claims::claims_storage::import_claims(claims, user_claims, market_claims, next_id);
        }
    });
    
    // Restore market resolution details if available
    STABLE_MARKET_RESOLUTION_DETAILS.with(|stable_details| {
        if let Some(details_vec) = stable_details.borrow_mut().take() {
            // Convert Vec<(K,V)> back to HashMap
            let resolution_details: std::collections::HashMap<MarketId, MarketResolutionDetails> = 
                details_vec.into_iter().collect();
            
            // Restore to the in-memory HashMap
            MARKET_RESOLUTION_DETAILS.with(|details_map| {
                *details_map.borrow_mut() = resolution_details;
            });
        }
    });
}
