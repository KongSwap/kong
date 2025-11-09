use candid::Nat;
use kong_lib::{ic::get_time, stable_transfer::{stable_transfer::{StableTransfer, StableTransferId}, tx_id::TxId}};

use crate::stable_memory::{TRANSFER_MAP, inc_transfer_map_idx};


pub fn get_by_transfer_id(transfer_id: u64) -> Option<StableTransfer> {
    TRANSFER_MAP.with(|m| m.borrow().get(&StableTransferId(transfer_id)))
}

pub fn contain(token_id: u32, block_id: &Nat) -> bool {
    TRANSFER_MAP.with(|m| {
        m.borrow()
            .iter()
            .any(|(_, v)| v.token_id == token_id && v.tx_id == TxId::BlockIndex(block_id.clone()))
    })
}

pub fn insert(transfer: &StableTransfer) -> u64 {
    TRANSFER_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let transfer_id = inc_transfer_map_idx();
        let insert_transfer = StableTransfer {
            transfer_id,
            ..transfer.clone()
        };
        map.insert(StableTransferId(transfer_id), insert_transfer);
        transfer_id
    })
}

pub fn cleanup_transfer_map() {
    // only keep transfers from the last hour
    let one_hour_ago = get_time::get_time() - 3_600_000_000_000;
    let mut remove_list = Vec::new();
    TRANSFER_MAP.with(|transfer_map| {
        transfer_map.borrow().iter().for_each(|(transfer_id, transfer)| {
            if transfer.ts < one_hour_ago {
                remove_list.push(transfer_id);
            }
        });
    });
    TRANSFER_MAP.with(|transfer_map| {
        remove_list.iter().for_each(|transfer_id| {
            transfer_map.borrow_mut().remove(transfer_id);
        });
    });
}