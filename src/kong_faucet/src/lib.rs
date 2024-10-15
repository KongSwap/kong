use crate::canister::logging::log;
use crate::stable_user::stable_user::{StableUser, StableUserId};
use ic_cdk::{init, post_upgrade, pre_upgrade};
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap};
use std::cell::RefCell;

mod canister;
mod claim;
mod stable_user;

pub const APP_NAME: &str = "Kong Swap Faucet";
pub const APP_VERSION: &str = "v0.0.8";

type Memory = VirtualMemory<DefaultMemoryImpl>;

const USER_MEMORY_ID: MemoryId = MemoryId::new(0);

thread_local! {
    // MEMORY_MANAGER is given management of the entire stable memory. Given a 'MemoryId', it can
    // return a memory that can be used by stable structures
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    static USER_MAP: RefCell<StableBTreeMap<StableUserId, StableUser, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(USER_MEMORY_ID)))
    });
}

/// A helper function to access the memory manager.
fn with_memory_manager<R>(f: impl FnOnce(&MemoryManager<DefaultMemoryImpl>) -> R) -> R {
    MEMORY_MANAGER.with(|cell| f(&cell.borrow()))
}

#[init]
async fn init() {
    log(&format!("{} canister has been initialized", APP_NAME));
}

#[pre_upgrade]
fn pre_upgrade() {
    log(&format!("{} canister is being upgraded", APP_NAME));
}

#[post_upgrade]
async fn post_upgrade() {
    log(&format!("{} canister is upgraded", APP_NAME));
}

ic_cdk::export_candid!();
