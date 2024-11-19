use ic_cdk::query;
use ic_stable_structures::Memory;
use serde_json::json;

use crate::helpers::math_helpers::{bytes_to_megabytes, to_trillions};
use crate::ic::guards::caller_is_kingkong;
use crate::stable_claim::stable_claim::ClaimStatus;
use crate::stable_memory::{
    CLAIM_MAP, CLAIM_MEMORY_ID, KONG_SETTINGS_ID, LP_TOKEN_LEDGER, LP_TOKEN_LEDGER_MEMORY_ID, MEMORY_MANAGER, MESSAGE_MAP,
    MESSAGE_MEMORY_ID, POOL_MAP, POOL_MEMORY_ID, REQUEST_ARCHIVE_MAP, REQUEST_MAP, REQUEST_MEMORY_ARCHIVE_ID, REQUEST_MEMORY_ID, TOKEN_MAP,
    TOKEN_MEMORY_ID, TRANSFER_ARCHIVE_MAP, TRANSFER_MAP, TRANSFER_MEMORY_1H_ID, TRANSFER_MEMORY_ARCHIVE_ID, TRANSFER_MEMORY_ID, TX_24H_MAP,
    TX_ARCHIVE_MAP, TX_MAP, TX_MEMORY_ARCHIVE_ID, TX_MEMORY_ID, USER_MAP, USER_MEMORY_ID,
};

#[cfg(target_arch = "wasm32")]
const WASM_PAGE_SIZE: u64 = 65536;

fn get_cycles() -> u128 {
    #[cfg(target_arch = "wasm32")]
    {
        ic_cdk::api::canister_balance128()
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        0
    }
}

fn get_stable_memory_size() -> u64 {
    #[cfg(target_arch = "wasm32")]
    {
        (ic_cdk::api::stable::stable_size() as u64) * WASM_PAGE_SIZE
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        0
    }
}

fn get_heap_memory_size() -> u64 {
    #[cfg(target_arch = "wasm32")]
    {
        (core::arch::wasm32::memory_size(0) as u64) * WASM_PAGE_SIZE
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        0
    }
}

#[query(hidden = true, guard = "caller_is_kingkong")]
async fn status() -> Result<String, String> {
    serde_json::to_string(&json! {
        {
            "Kong Backend Cycles Balance": format!("{} T", to_trillions(get_cycles())),
            "Heap Memory": format!("{} MiB", bytes_to_megabytes(get_heap_memory_size())),
            "Stable Memory": format!("{} MiB", bytes_to_megabytes(get_stable_memory_size())),
            "Stable - Kong Settings": format!("{} x 64k WASM page", MEMORY_MANAGER.with(|m| m.borrow().get(KONG_SETTINGS_ID).size())),
            "Stable - User Map": format!("{} x 64k WASM page", MEMORY_MANAGER.with(|m| m.borrow().get(USER_MEMORY_ID).size())),
            "Stable - Token Map": format!("{} x 64k WASM page", MEMORY_MANAGER.with(|m| m.borrow().get(TOKEN_MEMORY_ID).size())),
            "Stable - Pool Map": format!("{} x 64k WASM page", MEMORY_MANAGER.with(|m| m.borrow().get(POOL_MEMORY_ID).size())),
            "Stable - Tx Map": format!("{} x 64k WASM page", MEMORY_MANAGER.with(|m| m.borrow().get(TX_MEMORY_ID).size())),
            "Stable - Tx Map Archive": format!("{} x 64k WASM page", MEMORY_MANAGER.with(|m| m.borrow().get(TX_MEMORY_ARCHIVE_ID).size())),
            "Stable - Request Map": format!("{} x 64k WASM page", MEMORY_MANAGER.with(|m| m.borrow().get(REQUEST_MEMORY_ID).size())),
            "Stable - Request Map Archive": format!("{} x 64k WASM page", MEMORY_MANAGER.with(|m| m.borrow().get(REQUEST_MEMORY_ARCHIVE_ID).size())),
            "Stable - Transfer Map": format!("{} x 64k WASM page", MEMORY_MANAGER.with(|m| m.borrow().get(TRANSFER_MEMORY_ID).size())),
            "Stable - Transfer Map Archive": format!("{} x 64k WASM page", MEMORY_MANAGER.with(|m| m.borrow().get(TRANSFER_MEMORY_ARCHIVE_ID).size())),
            "Stable - Transfer Map (1h)": format!("{} x 64k WASM page", MEMORY_MANAGER.with(|m| m.borrow().get(TRANSFER_MEMORY_1H_ID).size())),
            "Stable - Claim Map": format!("{} x 64k WASM page", MEMORY_MANAGER.with(|m| m.borrow().get(CLAIM_MEMORY_ID).size())),
            "Stable - LP Token Ledger Map": format!("{} x 64k WASM page", MEMORY_MANAGER.with(|m| m.borrow().get(LP_TOKEN_LEDGER_MEMORY_ID).size())),
            "Stable - Message Map": format!("{} x 64k WASM page", MEMORY_MANAGER.with(|m| m.borrow().get(MESSAGE_MEMORY_ID).size())),
            "# of users": get_number_of_users(),
            "# of tokens": get_number_of_tokens(),
            "# of pools": get_number_of_pools(),
            "# of requests (1h)": get_number_of_requests(),
            "# of requests (archive)": get_number_of_requests_archive(),
            "# of swaps (24h)": get_number_of_swaps_24h(),
            "# of txs (1h)": get_number_of_txs(),
            "# of txs (archive)": get_number_of_txs_archive(),
            "# of transfers (1h)": get_number_of_transfers(),
            "# of transfers (archive)": get_number_of_transfers_archive(),
            "# of unclaimed claims": get_number_of_unclaimed_claims(),
            "# of LP positions": get_number_of_lp_positions(),
            "# of messages": get_number_of_messages(),
        }
    })
    .map_err(|e| format!("Failed to serialize: {}", e))
}

pub fn get_number_of_users() -> u64 {
    USER_MAP.with(|m| m.borrow().len())
}

pub fn get_number_of_tokens() -> u64 {
    TOKEN_MAP.with(|m| m.borrow().len())
}

pub fn get_number_of_pools() -> u64 {
    POOL_MAP.with(|m| m.borrow().len())
}

pub fn get_number_of_txs() -> u64 {
    TX_MAP.with(|m| m.borrow().len())
}

pub fn get_number_of_swaps_24h() -> u64 {
    TX_24H_MAP.with(|m| m.borrow().len())
}

pub fn get_number_of_txs_archive() -> u64 {
    TX_ARCHIVE_MAP.with(|m| m.borrow().len())
}

pub fn get_number_of_requests() -> u64 {
    REQUEST_MAP.with(|m| m.borrow().len())
}

pub fn get_number_of_requests_archive() -> u64 {
    REQUEST_ARCHIVE_MAP.with(|m| m.borrow().len())
}

pub fn get_number_of_transfers() -> u64 {
    TRANSFER_MAP.with(|m| m.borrow().len())
}

pub fn get_number_of_transfers_archive() -> u64 {
    TRANSFER_ARCHIVE_MAP.with(|m| m.borrow().len())
}

pub fn get_number_of_unclaimed_claims() -> usize {
    CLAIM_MAP.with(|m| {
        m.borrow()
            .iter()
            .filter(|(_, v)| v.status == ClaimStatus::Unclaimed || v.status == ClaimStatus::TooManyAttempts)
            .count()
    })
}

pub fn get_number_of_lp_positions() -> u64 {
    LP_TOKEN_LEDGER.with(|m| m.borrow().len())
}

pub fn get_number_of_messages() -> u64 {
    MESSAGE_MAP.with(|m| m.borrow().len())
}
