use crate::stable_memory::TRANSFER_MAP;
use crate::stable_transfer::stable_transfer::{StableTransfer, StableTransferId};

pub fn get_by_transfer_id(transfer_id: u64) -> Option<StableTransfer> {
    TRANSFER_MAP.with(|m| m.borrow().get(&StableTransferId(transfer_id)))
}
