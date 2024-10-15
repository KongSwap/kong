use candid::{CandidType, Decode, Deserialize, Encode};
use ic_stable_structures::{storable::Bound, Storable};
use icrc_ledger_types::icrc1::account::Account;
use serde::Serialize;
use std::borrow::Cow;

use crate::{
    canister::id::{kong_account, kong_backend_id},
    REQUEST_MAP,
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
    pub request_map_idx: u64, // counter for REQUEST_MAP
    pub claims_interval_secs: u64,
    pub stats_interval_secs: u64,
    pub requests_archive_interval_secs: u64,
    pub txs_archive_interval_secs: u64,
    pub transfers_archive_interval_secs: u64,
    pub lp_token_ledger_archive_interval_secs: u64,
}

impl Default for StableKongSettings {
    fn default() -> Self {
        let request_map_idx = REQUEST_MAP.with(|m| m.borrow().iter().map(|(k, _)| k.0).max().unwrap_or(0) + 1);
        Self {
            // kong_backend will be initialized on init()
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
            request_map_idx,
            claims_interval_secs: 300,                   // claims every 5 minutes
            stats_interval_secs: 3600,                   // stats every hour
            requests_archive_interval_secs: 3600,        // archive requests every hour
            txs_archive_interval_secs: 3600,             // archive txs every hour
            transfers_archive_interval_secs: 3600,       // archive transfers every hour
            lp_token_ledger_archive_interval_secs: 3600, // archive lp_positions every hour
        }
    }
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
