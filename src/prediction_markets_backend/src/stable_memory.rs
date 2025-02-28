use candid::Principal;
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl, StableBTreeMap,
};
use std::cell::RefCell;

use crate::bet::bet::*;
use crate::market::market::*;
use crate::nat::*;

type Memory = VirtualMemory<DefaultMemoryImpl>;

// Stable memory configuration using thread_local storage
thread_local! {
    /// Memory manager for stable storage allocation
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    /// Stores the accumulated house fees
    pub static FEE_BALANCE: RefCell<StableBTreeMap<Principal, u64, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(4))),
        )
    );

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

    /// Stores whitelisted oracle principals
    pub static ORACLES: RefCell<StableBTreeMap<Principal, bool, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(3))),
        )
    );
}
