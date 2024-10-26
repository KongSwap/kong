use candid::Nat;
use std::collections::BTreeMap;

use super::tx_id::TxId;

use crate::stable_kong_settings::kong_settings;
use crate::stable_memory::{TRANSFER_1H_MAP, TRANSFER_MAP};
use crate::stable_transfer::stable_transfer::{StableTransfer, StableTransferId};

pub fn get_by_transfer_id(transfer_id: u64) -> Option<StableTransfer> {
    TRANSFER_MAP.with(|m| m.borrow().get(&StableTransferId(transfer_id)))
}

pub fn get(max_requests: usize) -> Vec<StableTransfer> {
    TRANSFER_MAP.with(|m| {
        m.borrow()
            .iter()
            .collect::<BTreeMap<_, _>>()
            .iter()
            .rev()
            .take(max_requests)
            .map(|(_, v)| v.clone())
            .collect()
    })
}

/// check if a transfer is already in the map. If so, used to detect if double recieve/spend where system already processed the transfer
pub fn contain(token_id: u32, block_id: &Nat) -> bool {
    TRANSFER_1H_MAP.with(|m| {
        m.borrow()
            .iter()
            .any(|(_, v)| v.token_id == token_id && v.tx_id == TxId::BlockIndex(block_id.clone()))
    })
}

/// insert into both TRANSFER_MAP and TRANSFER_1H_MAP
/// TRANSFER_MAP is the main map for all transfers
/// TRANSFER_1H_MAP is a map for the last 1h of transfers, used to check for double recieve/spend
pub fn insert(transfer: &StableTransfer) -> u64 {
    let transfer = TRANSFER_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let transfer_id = kong_settings::inc_transfer_map_idx();
        let insert_transfer = StableTransfer {
            transfer_id,
            ..transfer.clone()
        };
        map.insert(StableTransferId(transfer_id), insert_transfer.clone());
        insert_transfer
    });

    // insert also to the transfer 1h map
    TRANSFER_1H_MAP.with(|m| {
        let mut map = m.borrow_mut();
        map.insert(StableTransferId(transfer.transfer_id), transfer.clone());
    });

    transfer.transfer_id
}
