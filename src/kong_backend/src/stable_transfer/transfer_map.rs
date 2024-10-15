use candid::Nat;
use std::cmp::Reverse;

use super::tx_id::TxId;

use crate::stable_transfer::stable_transfer::{StableTransfer, StableTransferId};
use crate::TRANSFER_MAP;

pub fn get_by_transfer_id(transfer_id: u64) -> Option<StableTransfer> {
    TRANSFER_MAP.with(|m| m.borrow().get(&StableTransferId(transfer_id)))
}

#[allow(dead_code)]
pub fn get(max_requests: Option<usize>) -> Vec<StableTransfer> {
    let mut transfers: Vec<StableTransfer> = TRANSFER_MAP.with(|m| m.borrow().iter().map(|(_, v)| v).collect());
    // order by timestamp in reverse order
    transfers.sort_by_key(|transfer| Reverse(transfer.ts));
    if let Some(max_requests) = max_requests {
        transfers.into_iter().take(max_requests).collect()
    } else {
        transfers
    }
}

// check if a transfer is already in the map. used to detect if double recieve/spend where system already processed the transfer
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
        // with lock, increase transfer id key
        let transfer_id = map.iter()
            .map(|(k, _)| k.0)
            .max()
            .unwrap_or(0) // only if empty and first transfer
            + 1;
        let insert_transfer = StableTransfer {
            transfer_id,
            ..transfer.clone()
        };
        map.insert(StableTransferId(transfer_id), insert_transfer);
        transfer_id
    })
}
