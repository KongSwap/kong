use anyhow::{anyhow, Result};
use candid::Principal;
use pocket_ic::PocketIc;

pub type PicResult<T> = Result<T, pocket_ic::RejectResponse>;

/// Wrapper for update_call that converts PocketIc's RejectResponse errors to anyhow::Error
pub fn pic_update(ic: &PocketIc, canister_id: Principal, sender: Principal, method: &str, payload: Vec<u8>) -> Result<Vec<u8>> {
    ic.update_call(canister_id, sender, method, payload)
        .map_err(|e| anyhow!("PocketIC update call failed: {}", e.to_string()))
}

/// Wrapper for query_call that converts PocketIc's RejectResponse errors to anyhow::Error
pub fn pic_query(ic: &PocketIc, canister_id: Principal, sender: Principal, method: &str, payload: Vec<u8>) -> Result<Vec<u8>> {
    ic.query_call(canister_id, sender, method, payload)
        .map_err(|e| anyhow!("PocketIC query call failed: {}", e.to_string()))
}

/// Helper function to tick the replica a few times to allow inter-canister calls to process
pub fn ensure_processed(ic: &PocketIc) {
    // Increase from 5 to 15 ticks for more reliable processing
    for _ in 0..15 {
        ic.tick();
    }
}