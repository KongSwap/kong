use candid::{CandidType, Decode, Encode};
use ic_stable_structures::{storable::Bound, Storable};
use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};
use std::borrow::Cow;

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct StableKongSettings {
    pub kong_backend_id: String,
    pub kong_backend_account: Account,
    pub maintenance_mode: bool,
    pub kingkong: Vec<u32>, // list of user_ids for maintainers
    pub ckusdt_token_id: u32,
    pub ckusdt_symbol: String,
    pub ckusdt_symbol_with_chain: String,
    pub ckusdt_address: String,
    pub ckusdt_address_with_chain: String,
    pub icp_token_id: u32,
    pub icp_symbol: String,
    pub icp_symbol_with_chain: String,
    pub icp_address: String,
    pub icp_address_with_chain: String,
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
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        // if any error occurs retreiving the StableKongSettings, use the default
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    // unbounded size
    const BOUND: Bound = Bound::Unbounded;
}
