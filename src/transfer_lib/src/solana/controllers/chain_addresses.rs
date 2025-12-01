use ic_cdk::update;

use kong_lib::solana::error::SolanaError;
use crate::solana::network::SolanaNetwork;
use kong_lib::ic::id::is_caller_controller;
// use crate::kong_backend::KongBackend;
use crate::solana::stable_memory::{get_cached_solana_address, set_cached_solana_address};

async fn get_solana_address() -> Result<String, SolanaError> {
    SolanaNetwork::get_public_key(&ic_cdk::api::canister_self()).await
}
/// Cache the canister's Solana address (One-time initialization)
/// This method derives the Solana address from the canister's Ed25519 key
/// and stores it in memory for fast query access
/// Can only be called once - subsequent calls are rejected at ingress level if successfully cached
/// If already cached, it verifies the cached address matches the current derivation
#[update(hidden = true)]
pub async fn cache_solana_address() -> Result<String, String> {
    if !is_caller_controller() {
        return Err("Caller is not allowed to do action".to_string());
    }
    // Check if already cached
    let cached = get_cached_solana_address();
    match if cached.is_empty() {
        Err("Not cached".to_string())
    } else {
        Ok(cached)
    } {
        Ok(cached) => {
            // Derive the Solana address to verify cached value
            let address = get_solana_address()
                .await
                .map_err(|e| format!("Failed to derive Solana address: {}", e))?;

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
            // Not cached yet, derive it now
            let address = get_solana_address()
                .await
                .map_err(|e| format!("Failed to derive Solana address: {}", e))?;

            // Cache the address
            set_cached_solana_address(address.clone());
            Ok(format!("Successfully cached Solana address: {}", address))
        }
    }
}
