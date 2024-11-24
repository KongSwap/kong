use candid::Nat;

use super::tx_id::TxId;

use crate::stable_kong_settings::kong_settings;
use crate::stable_memory::TRANSFER_MAP;
use crate::stable_transfer::stable_transfer::{StableTransfer, StableTransferId};

pub fn get_by_transfer_id(transfer_id: u64) -> Option<StableTransfer> {
    TRANSFER_MAP.with(|m| m.borrow().get(&StableTransferId(transfer_id)))
}

pub fn get(max_requests: usize) -> Vec<StableTransfer> {
    TRANSFER_MAP.with(|m| m.borrow().iter().rev().take(max_requests).map(|(_, v)| v.clone()).collect())
}

pub fn contain(token_id: u32, block_id: &Nat) -> bool {
    TRANSFER_MAP.with(|m| {
        m.borrow()
            .iter()
            .any(|(_, v)| v.token_id == token_id && v.tx_id == TxId::BlockIndex(block_id.clone()))
    })
}
