use std::cmp;

use crate::stable_memory::KONG_SETTINGS;

use super::stable_kong_settings::StableKongSettings;

const LAST_SYSTEM_USER_ID: u32 = 99;

pub fn get() -> StableKongSettings {
    KONG_SETTINGS.with(|s| s.borrow().get().clone())
}

pub fn inc_user_map_idx() -> u32 {
    KONG_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        let kong_settings = map.get();
        let user_map_idx = cmp::max(LAST_SYSTEM_USER_ID, kong_settings.user_map_idx) + 1;
        let new_kong_settings = StableKongSettings {
            user_map_idx,
            ..kong_settings.clone()
        };
        _ = map.set(new_kong_settings);
        user_map_idx
    })
}

pub fn inc_token_map_idx() -> u32 {
    KONG_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        let kong_settings = map.get();
        let token_map_idx = kong_settings.token_map_idx + 1;
        let new_kong_settings = StableKongSettings {
            token_map_idx,
            ..kong_settings.clone()
        };
        _ = map.set(new_kong_settings);
        token_map_idx
    })
}

pub fn inc_pool_map_idx() -> u32 {
    KONG_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        let kong_settings = map.get();
        let pool_map_idx = kong_settings.pool_map_idx + 1;
        let new_kong_settings = StableKongSettings {
            pool_map_idx,
            ..kong_settings.clone()
        };
        _ = map.set(new_kong_settings);
        pool_map_idx
    })
}

pub fn inc_tx_map_idx() -> u64 {
    KONG_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        let kong_settings = map.get();
        let tx_map_idx = kong_settings.tx_map_idx + 1;
        let new_kong_settings = StableKongSettings {
            tx_map_idx,
            ..kong_settings.clone()
        };
        _ = map.set(new_kong_settings);
        tx_map_idx
    })
}

pub fn inc_request_map_idx() -> u64 {
    KONG_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        let kong_settings = map.get();
        let request_map_idx = kong_settings.request_map_idx + 1;
        let new_kong_settings = StableKongSettings {
            request_map_idx,
            ..kong_settings.clone()
        };
        _ = map.set(new_kong_settings);
        request_map_idx
    })
}

pub fn inc_transfer_map_idx() -> u64 {
    KONG_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        let kong_settings = map.get();
        let transfer_map_idx = kong_settings.transfer_map_idx + 1;
        let new_kong_settings = StableKongSettings {
            transfer_map_idx,
            ..kong_settings.clone()
        };
        _ = map.set(new_kong_settings);
        transfer_map_idx
    })
}

pub fn inc_claim_map_idx() -> u64 {
    KONG_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        let kong_settings = map.get();
        let claim_map_idx = kong_settings.claim_map_idx + 1;
        let new_kong_settings = StableKongSettings {
            claim_map_idx,
            ..kong_settings.clone()
        };
        _ = map.set(new_kong_settings);
        claim_map_idx
    })
}

pub fn inc_lp_token_map_idx() -> u64 {
    KONG_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        let kong_settings = map.get();
        let lp_token_map_idx = kong_settings.lp_token_map_idx + 1;
        let new_kong_settings = StableKongSettings {
            lp_token_map_idx,
            ..kong_settings.clone()
        };
        _ = map.set(new_kong_settings);
        lp_token_map_idx
    })
}

// Solana-specific functions

/// Enable or disable Solana integration
pub fn set_solana_enabled(enabled: bool) {
    KONG_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        // Get a complete clone of the settings first to avoid borrowing issues
        let mut kong_settings = map.get().clone();
        kong_settings.set_solana_enabled(enabled);
        _ = map.set(kong_settings);
    })
}

/// Get whether Solana integration is enabled
pub fn is_solana_enabled() -> bool {
    KONG_SETTINGS.with(|s| {
        let map = s.borrow();
        let kong_settings = map.get();
        kong_settings.sol_enabled
    })
}

/// Set Solana backend address (the address that receives funds)
pub fn set_sol_backend_address(address: Option<String>) {
    KONG_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        // Get a complete clone of the settings first to avoid borrowing issues
        let mut kong_settings = map.get().clone();
        kong_settings.set_sol_backend_address(address);
        _ = map.set(kong_settings);
    })
}

/// Get Solana backend address
pub fn get_sol_backend_address() -> Option<String> {
    KONG_SETTINGS.with(|s| {
        let map = s.borrow();
        let kong_settings = map.get();
        kong_settings.sol_backend_address.clone()
    })
}

/// Set Solana RPC endpoint
pub fn set_sol_rpc_endpoint(endpoint: Option<String>) {
    KONG_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        // Get a complete clone of the settings first to avoid borrowing issues
        let mut kong_settings = map.get().clone();
        kong_settings.set_sol_rpc_endpoint(endpoint);
        _ = map.set(kong_settings);
    })
}

/// Get Solana RPC endpoint
pub fn get_sol_rpc_endpoint() -> Option<String> {
    KONG_SETTINGS.with(|s| {
        let map = s.borrow();
        let kong_settings = map.get();
        kong_settings.sol_rpc_endpoint.clone()
    })
}

/// Set Solana network (mainnet-beta or devnet)
pub fn set_sol_network(network: Option<String>) {
    KONG_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        // Get a complete clone of the settings first to avoid borrowing issues
        let mut kong_settings = map.get().clone();
        kong_settings.set_sol_network(network);
        _ = map.set(kong_settings);
    })
}

/// Get Solana network
pub fn get_sol_network() -> Option<String> {
    KONG_SETTINGS.with(|s| {
        let map = s.borrow();
        let kong_settings = map.get();
        kong_settings.sol_network.clone()
    })
}

/// Set Wrapped SOL token address
pub fn set_sol_wsol_address(address: Option<String>) {
    KONG_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        // Get a complete clone of the settings first to avoid borrowing issues
        let mut kong_settings = map.get().clone();
        kong_settings.set_sol_wsol_address(address);
        _ = map.set(kong_settings);
    })
}

/// Get Wrapped SOL token address
pub fn get_sol_wsol_address() -> Option<String> {
    KONG_SETTINGS.with(|s| {
        let map = s.borrow();
        let kong_settings = map.get();
        kong_settings.sol_wsol_address.clone()
    })
}

/// Set Solana token program ID
pub fn set_sol_token_program_id(program_id: Option<String>) {
    KONG_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        // Get a complete clone of the settings first to avoid borrowing issues
        let mut kong_settings = map.get().clone();
        kong_settings.set_sol_token_program_id(program_id);
        _ = map.set(kong_settings);
    })
}

/// Get Solana token program ID
pub fn get_sol_token_program_id() -> Option<String> {
    KONG_SETTINGS.with(|s| {
        let map = s.borrow();
        let kong_settings = map.get();
        kong_settings.sol_token_program_id.clone()
    })
}

/// Set Solana system program ID
pub fn set_sol_system_program_id(program_id: Option<String>) {
    KONG_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        // Get a complete clone of the settings first to avoid borrowing issues
        let mut kong_settings = map.get().clone();
        kong_settings.set_sol_system_program_id(program_id);
        _ = map.set(kong_settings);
    })
}

/// Get Solana system program ID
pub fn get_sol_system_program_id() -> Option<String> {
    KONG_SETTINGS.with(|s| {
        let map = s.borrow();
        let kong_settings = map.get();
        kong_settings.sol_system_program_id.clone()
    })
}

/// Set Solana transaction timeout
pub fn set_sol_transaction_timeout(timeout_secs: Option<u64>) {
    KONG_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        // Get a complete clone of the settings first to avoid borrowing issues
        let mut kong_settings = map.get().clone();
        kong_settings.set_sol_transaction_timeout(timeout_secs);
        _ = map.set(kong_settings);
    })
}

/// Get Solana transaction timeout
pub fn get_sol_transaction_timeout() -> Option<u64> {
    KONG_SETTINGS.with(|s| {
        let map = s.borrow();
        let kong_settings = map.get();
        kong_settings.sol_transaction_timeout_secs
    })
}

/// Set Solana private key (VERY SENSITIVE - use with extreme caution)
/// This function should only be used in secure contexts and potentially
/// only during canister initialization
pub fn set_sol_private_key(key: Option<Vec<u8>>) {
    KONG_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        // Get a complete clone of the settings first to avoid borrowing issues
        let mut kong_settings = map.get().clone();
        kong_settings.set_sol_private_key(key);
        _ = map.set(kong_settings);
    })
}

/// Get all Solana settings as a tuple (except private key)
pub fn get_sol_settings() -> (bool, Option<String>, Option<String>, Option<String>, Option<String>, Option<u64>) {
    KONG_SETTINGS.with(|s| {
        let map = s.borrow();
        let kong_settings = map.get();
        kong_settings.get_sol_settings()
    })
}
