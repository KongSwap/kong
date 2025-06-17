use ic_cdk::update;

use crate::ic::guards::caller_is_kingkong;
use crate::kong_backend::KongBackend;
use crate::stable_memory::{get_cached_solana_address, set_cached_solana_address};

/// Cache the canister's Solana address (Controller only)
/// This method derives the Solana address from the canister's Ed25519 key
/// and stores it in memory for fast query access
/// If already cached, it verifies the cached address matches the current derivation
#[update(hidden = true, guard = "caller_is_kingkong")]
pub async fn cache_solana_address() -> Result<String, String> {
    // Derive the Solana address from the canister's Ed25519 key
    let address = KongBackend::get_solana_address()
        .await
        .map_err(|e| format!("Failed to derive Solana address: {}", e))?;

    // Check if already cached
    let cached = get_cached_solana_address();
    match if cached.is_empty() {
        Err("Not cached".to_string())
    } else {
        Ok(cached)
    } {
        Ok(cached) => {
            if cached == address {
                Ok(format!("Address already cached and verified: {}", cached))
            } else {
                // CRITICAL: Cached address doesn't match current derivation
                Err(format!(
                    "CRITICAL: Cached address ({}) differs from current derivation ({})! This indicates a serious issue!",
                    cached, address
                ))
            }
        }
        Err(_) => {
            // Not cached yet, cache it now
            set_cached_solana_address(address.clone());
            Ok(format!("Successfully cached Solana address: {}", address))
        }
    }
}
