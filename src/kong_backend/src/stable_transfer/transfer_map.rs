use candid::Nat;

use super::tx_id::TxId;

use crate::ic::logging::error_log;
use crate::stable_kong_settings::kong_settings_map;
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

pub fn insert(transfer: &StableTransfer) -> u64 {
    TRANSFER_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let transfer_id = kong_settings_map::inc_transfer_map_idx();
        let insert_transfer = StableTransfer {
            transfer_id,
            ..transfer.clone()
        };
        map.insert(StableTransferId(transfer_id), insert_transfer);
        transfer_id
    })
}

pub fn archive_to_kong_data(transfer_id: u64) -> Result<(), String> {
    let transfer = match get_by_transfer_id(transfer_id) {
        Some(transfer) => transfer,
        None => return Err(format!("Failed to archive. transfer_id #{} not found", transfer_id)),
    };
    let transfer_json = match serde_json::to_string(&transfer) {
        Ok(transfer_json) => transfer_json,
        Err(e) => return Err(format!("Failed to archive transfer_id #{}. {}", transfer_id, e)),
    };

    ic_cdk::spawn(async move {
        let kong_data = kong_settings_map::get().kong_data;
        match ic_cdk::call::<(String,), (Result<String, String>,)>(kong_data, "update_transfer", (transfer_json,))
            .await
            .map_err(|e| e.1)
            .unwrap_or_else(|e| (Err(e),))
            .0
        {
            Ok(_) => (),
            Err(e) => error_log(&format!("Failed to archive transfer_id #{}. {}", transfer.transfer_id, e)),
        }
    });

    Ok(())
}
