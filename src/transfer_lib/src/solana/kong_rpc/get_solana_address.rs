use ic_cdk::query;

use super::super::stable_memory::get_cached_solana_address;

/// Get the cached Solana address for this canister
/// This is a fast query method that returns the cached address
/// 
/// TODO! Potentially solana PDA account here too, perhaps we use that as gas fee account and can top that up with sol
/// instead of having 1 balance for LP + gas
#[query]
pub fn get_solana_address() -> String {
    get_cached_solana_address()
}
