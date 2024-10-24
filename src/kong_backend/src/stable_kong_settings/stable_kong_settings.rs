use candid::{CandidType, Decode, Encode};
use ic_stable_structures::{storable::Bound, Storable};
use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::cmp;

use crate::ic::id::{kong_account, kong_backend_id};
use crate::stable_memory::{
    CLAIM_MAP, MESSAGE_MAP, POOL_MAP, REQUEST_ARCHIVE_MAP, REQUEST_MAP, TOKEN_MAP, TRANSFER_ARCHIVE_MAP, TRANSFER_MAP, TX_ARCHIVE_MAP,
    TX_MAP, USER_MAP,
};

const CKUSDT_SYMBOL: &str = "ckUSDT";
const CKUSDT_SYMBOL_WITH_CHAIN: &str = "IC.ckUSDT";
#[cfg(not(feature = "prod"))]
const CKUSDT_ADDRESS: &str = "zdzgz-siaaa-aaaar-qaiba-cai";
#[cfg(not(feature = "prod"))]
const CKUSDT_ADDRESS_WITH_CHAIN: &str = "IC.zdzgz-siaaa-aaaar-qaiba-cai";
#[cfg(feature = "prod")]
const CKUSDT_ADDRESS: &str = "cngnf-vqaaa-aaaar-qag4q-cai";
#[cfg(feature = "prod")]
const CKUSDT_ADDRESS_WITH_CHAIN: &str = "IC.cngnf-vqaaa-aaaar-qag4q-cai";

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct StableKongSettings {
    pub kong_backend_id: String,
    pub kong_backend_account: Account,
    pub maintenance_mode: bool,
    pub kingkong: Vec<u32>, // list of user_ids for maintainers
    pub ckusdt_symbol: String,
    pub ckusdt_symbol_with_chain: String,
    pub ckusdt_address: String,
    pub ckusdt_address_with_chain: String,
    pub default_max_slippage: f64,
    pub default_lp_fee_bps: u8,
    pub default_kong_fee_bps: u8,
    pub user_map_idx: u32,     // counter for USER_MAP
    pub token_map_idx: u32,    // counter for TOKEN_MAP
    pub pool_map_idx: u32,     // counter for POOL_MAP
    pub claim_map_idx: u64,    // counter for CLAIM_MAP
    pub message_map_idx: u64,  // counter for MESSAGE_MAP
    pub request_map_idx: u64,  // counter for REQUEST_MAP
    pub transfer_map_idx: u64, // counter for TRANSFER_MAP
    pub tx_map_idx: u64,       // counter for TX_MAP
    pub claims_interval_secs: u64,
    pub transfer_expiry_nanosecs: u64,
    pub stats_interval_secs: u64,
    pub requests_archive_interval_secs: u64,
    pub txs_archive_interval_secs: u64,
    pub transfers_archive_interval_secs: u64,
    pub lp_token_ledger_archive_interval_secs: u64,
}

impl Storable for StableKongSettings {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        // if any error occurs saving, use the default StableKongSettings
        Cow::Owned(Encode!(self).unwrap_or_default())
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        // if any error occurs retreiving the StableKongSettings, use the default
        Decode!(bytes.as_ref(), Self).unwrap_or_default()
    }

    // unbounded size
    const BOUND: Bound = Bound::Unbounded;
}

impl Default for StableKongSettings {
    fn default() -> Self {
        let user_map_idx = USER_MAP.with(|m| m.borrow().iter().map(|(k, _)| k.0).max().unwrap_or(0));
        let token_map_idx = TOKEN_MAP.with(|m| m.borrow().iter().map(|(k, _)| k.0).max().unwrap_or(0));
        let pool_map_idx = POOL_MAP.with(|m| m.borrow().iter().map(|(k, _)| k.0).max().unwrap_or(0));
        let claim_map_idx = CLAIM_MAP.with(|m| m.borrow().iter().map(|(k, _)| k.0).max().unwrap_or(0));
        let message_map_idx = MESSAGE_MAP.with(|m| m.borrow().iter().map(|(k, _)| k.0).max().unwrap_or(0));
        let request_map_idx = cmp::max(
            REQUEST_MAP.with(|m| m.borrow().iter().map(|(k, _)| k.0).max().unwrap_or(0)),
            REQUEST_ARCHIVE_MAP.with(|m| m.borrow().iter().map(|(k, _)| k.0).max().unwrap_or(0)),
        );
        let transfer_map_idx = cmp::max(
            TRANSFER_MAP.with(|m| m.borrow().iter().map(|(k, _)| k.0).max().unwrap_or(0)),
            TRANSFER_ARCHIVE_MAP.with(|m| m.borrow().iter().map(|(k, _)| k.0).max().unwrap_or(0)),
        );
        let tx_map_idx = cmp::max(
            TX_MAP.with(|m| m.borrow().iter().map(|(k, _)| k.0).max().unwrap_or(0)),
            TX_ARCHIVE_MAP.with(|m| m.borrow().iter().map(|(k, _)| k.0).max().unwrap_or(0)),
        );
        Self {
            kong_backend_id: kong_backend_id(),
            kong_backend_account: kong_account(),
            maintenance_mode: false,
            kingkong: vec![100, 101], // default kingkong users
            ckusdt_symbol: CKUSDT_SYMBOL.to_string(),
            ckusdt_symbol_with_chain: CKUSDT_SYMBOL_WITH_CHAIN.to_string(),
            ckusdt_address: CKUSDT_ADDRESS.to_string(),
            ckusdt_address_with_chain: CKUSDT_ADDRESS_WITH_CHAIN.to_string(),
            default_max_slippage: 2.0_f64,
            default_lp_fee_bps: 30,
            default_kong_fee_bps: 0,
            user_map_idx,
            token_map_idx,
            pool_map_idx,
            claim_map_idx,
            message_map_idx,
            request_map_idx,
            transfer_map_idx,
            tx_map_idx,
            claims_interval_secs: 300,                   // claims every 5 minutes
            transfer_expiry_nanosecs: 3_600_000_000_000, // 1 hour (nano seconds)
            stats_interval_secs: 3600,                   // stats every hour
            requests_archive_interval_secs: 3600,        // archive requests every hour
            txs_archive_interval_secs: 3600,             // archive txs every hour
            transfers_archive_interval_secs: 3600,       // archive transfers every hour
            lp_token_ledger_archive_interval_secs: 3600, // archive lp_positions every hour
        }
    }
}
