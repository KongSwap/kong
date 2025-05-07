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

use crate::bet::bet::*;
use crate::market::market::*;
use crate::resolution::resolution::ResolutionProposal;
use crate::types::MarketId;

/// Type alias for the virtual memory used by stable collections
/// 
/// This is a virtual memory region backed by the Internet Computer's DefaultMemoryImpl,
/// which provides guaranteed persistence across canister upgrades.
type Memory = VirtualMemory<DefaultMemoryImpl>;

// Stable memory configuration for persistent data storage
thread_local! {
    /// Stable memory configuration using thread_local storage
    /// 
    /// These thread-local variables define the stable data structures that persist
    /// across canister upgrades. Each structure is allocated a specific memory region
    /// by the memory manager.
    /// Memory manager for stable storage allocation
    /// 
    /// This central manager handles allocation of memory regions to different
    /// stable data structures. It ensures proper isolation between collections
    /// and manages the underlying stable memory pages.
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    /// Stores all markets indexed by their ID
    /// 
    /// This is the primary collection for market data, including market configurations,
    /// outcome pools, statuses, and other market-specific information. It uses memory
    /// region 0 and is indexed by the unique MarketId.
    pub static MARKETS: RefCell<StableBTreeMap<MarketId, Market, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0))),
        )
    );

    /// Stores all bets for each market
    /// 
    /// This collection maintains all bets placed on each market, organized by market ID.
    /// The BetStore wrapper handles collections of bets for efficient storage. Uses memory
    /// region 1 and is essential for payout calculations during market resolution.
    pub static BETS: RefCell<StableBTreeMap<MarketId, BetStore, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(1))),
        )
    );

    /// Stores user token balances
    /// 
    /// This collection tracks token balances for each user, indexed by their Principal ID.
    /// Uses memory region 2 and is used for legacy token handling before the multi-token
    /// system was implemented. New markets use direct ledger transfers instead.
    pub static BALANCES: RefCell<StableBTreeMap<Principal, u64, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(2))),
        )
    );

    /// Stores the accumulated house fees
    /// 
    /// This collection tracks platform fees collected from markets, organized by token type.
    /// Uses memory region 3 and is primarily used for administrative accounting and
    /// fee withdrawal operations. For KONG tokens, fees are burned rather than collected.
    pub static FEE_BALANCE: RefCell<StableBTreeMap<Principal, u64, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(3))),
        )
    );

    /// Stores whitelisted oracle principals
    /// 
    /// This collection maintains a whitelist of approved oracle Principals that can
    /// participate in oracle-based market resolution. Uses memory region 4 and is
    /// used to validate oracle authorizations during resolution operations.
    pub static ORACLES: RefCell<StableBTreeMap<Principal, bool, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(4))),
        )
    );

    /// Stores user delegation configurations
    /// 
    /// This collection maintains delegation settings where users can grant permissions
    /// to other entities to act on their behalf. Uses memory region 5 and supports
    /// functionality like allowing managers to place bets for users.
    pub static DELEGATIONS: RefCell<StableBTreeMap<Principal, DelegationVec, VirtualMemory<DefaultMemoryImpl>>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(5))),
        )
    );
    
    /// Stores resolution proposals for dual approval system
    /// 
    /// This collection tracks resolution proposals for user-created markets that
    /// require dual approval between creators and admins. Uses memory region 6 and
    /// is central to the governance system that prevents fraudulent resolutions.
    pub static RESOLUTION_PROPOSALS: RefCell<StableBTreeMap<MarketId, ResolutionProposal, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(6))),
        )
    );
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
/// 3. Any future migrations or state adjustments can be added to this function
/// 
/// # Usage
/// This should only be called from the post_upgrade hook in lib.rs
pub fn restore() {
    // The stable memory is automatically preserved across upgrades
    // This function performs additional restoration steps
    
    ic_cdk::println!("Stable memory state restored");
    
    // Update the market ID counter to match the highest market ID
    // This ensures we don't reuse IDs after an upgrade
    if let Some((max_id, _)) = MARKETS.with(|markets| {
        let markets_ref = markets.borrow();
        markets_ref.iter().last() // Get the highest market ID
    }) {
        // Ensure the MARKET_ID atomic counter starts above the highest existing ID
        crate::market::create_market::MARKET_ID.store(
            max_id.to_u64(),
            std::sync::atomic::Ordering::SeqCst
        );
    }
}
