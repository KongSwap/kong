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

type Memory = VirtualMemory<DefaultMemoryImpl>;

// Stable memory configuration using thread_local storage
thread_local! {
    /// Memory manager for stable storage allocation
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    /// Stores all markets indexed by their ID
    pub static MARKETS: RefCell<StableBTreeMap<MarketId, Market, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0))),
        )
    );

    /// Stores all bets for each market
    pub static BETS: RefCell<StableBTreeMap<MarketId, BetStore, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(1))),
        )
    );

    /// Stores user token balances
    pub static BALANCES: RefCell<StableBTreeMap<Principal, u64, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(2))),
        )
    );

    /// Stores the accumulated house fees
    pub static FEE_BALANCE: RefCell<StableBTreeMap<Principal, u64, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(3))),
        )
    );

    /// Stores whitelisted oracle principals
    pub static ORACLES: RefCell<StableBTreeMap<Principal, bool, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(4))),
        )
    );

    pub static DELEGATIONS: RefCell<StableBTreeMap<Principal, DelegationVec, VirtualMemory<DefaultMemoryImpl>>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(5))),
        )
    );
    
    /// Stores resolution proposals for dual approval system
    pub static RESOLUTION_PROPOSALS: RefCell<StableBTreeMap<MarketId, ResolutionProposal, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(6))),
        )
    );
}

/// Restores the stable memory state after an upgrade
/// This function is called by post_upgrade in lib.rs
pub fn restore() {
    // The stable memory is automatically preserved across upgrades
    // This function is here to provide a hook for any additional
    // restoration steps that might be needed in the future
    
    ic_cdk::println!("Stable memory state restored");
    
    // Update the market ID counter to match the highest market ID
    if let Some((max_id, _)) = MARKETS.with(|markets| {
        let markets_ref = markets.borrow();
        markets_ref.iter().last()
    }) {
        // Ensure the MARKET_ID atomic counter starts above the highest existing ID
        crate::market::create_market::MARKET_ID.store(
            max_id.to_u64(),
            std::sync::atomic::Ordering::SeqCst
        );
    }
}
