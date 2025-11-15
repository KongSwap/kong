use std::cell::RefCell;

use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl, StableBTreeMap, StableCell,
};

use kong_lib::stable_transfer::stable_transfer::{StableTransfer, StableTransferId};

use crate::stable_transfer_settings::StableTransferSettings;

type Memory = VirtualMemory<DefaultMemoryImpl>;

pub const TRANSFER_MEMORY_ID: MemoryId = MemoryId::new(27);
pub const TRANSFER_SETTINGS_MEMORY_ID: MemoryId = MemoryId::new(59);

thread_local! {
    pub static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));
}

/// A helper function to access the memory manager.
pub fn with_memory_manager<R>(f: impl FnOnce(&MemoryManager<DefaultMemoryImpl>) -> R) -> R {
    MEMORY_MANAGER.with(|cell| f(&cell.borrow()))
}

thread_local! {
    // stable memory for storing all on-chain transfers with block_id. used to prevent accepting transfer twice (double receive)
    pub static TRANSFER_MAP: RefCell<StableBTreeMap<StableTransferId, StableTransfer, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableBTreeMap::init(memory_manager.get(TRANSFER_MEMORY_ID)))
    });
    pub static TRANSFER_SETTINGS: RefCell<StableCell<StableTransferSettings, Memory>> = with_memory_manager(|memory_manager| {
        RefCell::new(StableCell::init(memory_manager.get(TRANSFER_SETTINGS_MEMORY_ID), StableTransferSettings::default()).expect("Failed to initialize Kong settings"))
    });
}

pub fn inc_transfer_map_idx() -> u64 {
    TRANSFER_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        let transfer_settings = map.get();
        let transfer_map_idx = transfer_settings.transfer_map_idx + 1;
        let new_kong_settings = StableTransferSettings {
            transfer_map_idx,
            ..transfer_settings.clone()
        };
        _ = map.set(new_kong_settings);
        transfer_map_idx
    })
}
