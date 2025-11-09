use ic_cdk::update;

use crate::solana::guards::caller_is_kong_rpc;

use super::super::stable_memory::with_solana_blockhash_mut;

/// Update the Solana blockhash (called by kong_rpc)
#[update(hidden = true, guard = "caller_is_kong_rpc")]
pub fn update_solana_blockhash(blockhash: String) -> Result<(), String> {
    with_solana_blockhash_mut(|cell| {
        cell.set(blockhash).map_err(|_| "Failed to update Solana blockhash".to_string())?;
        Ok(())
    })
}
