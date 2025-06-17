use ic_cdk::query;

use crate::stable_memory::get_cached_solana_address;

/// Get the cached Solana address for this canister
/// This is a fast query method that returns the cached address
/// If not cached, returns an error suggesting to call cache_solana_address first
#[query]
pub fn get_solana_address() -> Result<String, String> {
    let address = get_cached_solana_address();
    if address.is_empty() {
        Err("Solana address not available".to_string())
    } else {
        Ok(address)
    }
}
