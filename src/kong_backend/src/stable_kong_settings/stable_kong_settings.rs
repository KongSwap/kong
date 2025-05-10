use candid::{CandidType, Principal};
use ic_stable_structures::{storable::Bound, Storable};
use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};
use std::cmp;

use crate::ic::{
    canister_address::{KONG_BACKEND, KONG_DATA},
    ckusdt::{CKUSDT_ADDRESS, CKUSDT_ADDRESS_WITH_CHAIN, CKUSDT_SYMBOL, CKUSDT_SYMBOL_WITH_CHAIN, CKUSDT_TOKEN_ID},
    icp::{ICP_ADDRESS, ICP_ADDRESS_WITH_CHAIN, ICP_SYMBOL, ICP_SYMBOL_WITH_CHAIN, ICP_TOKEN_ID},
};
use crate::stable_memory::{
    CLAIM_MAP, LP_TOKEN_MAP, POOL_MAP, REQUEST_ARCHIVE_MAP, REQUEST_MAP, TOKEN_MAP, TRANSFER_ARCHIVE_MAP, TRANSFER_MAP, TX_ARCHIVE_MAP,
    TX_MAP, USER_MAP,
};

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct StableKongSettings {
    pub kong_backend: Account,
    pub kong_data: Principal,
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
    pub tx_map_idx: u64,       // counter for TX_MAP
    pub request_map_idx: u64,  // counter for REQUEST_MAP
    pub transfer_map_idx: u64, // counter for TRANSFER_MAP
    pub claim_map_idx: u64,    // counter for CLAIM_MAP
    pub lp_token_map_idx: u64, // counter for LP_TOKEN_MAP
    pub claims_interval_secs: u64,
    pub transfer_expiry_nanosecs: u64,
    pub requests_archive_interval_secs: u64,
    pub txs_archive_interval_secs: u64,
    pub transfers_archive_interval_secs: u64,
    pub archive_to_kong_data: bool,

    // Solana specific settings
    pub sol_enabled: bool,                         // Whether Solana integration is enabled
    pub sol_backend_address: Option<String>,       // Kong's Solana wallet address for receiving funds
    pub sol_private_key: Option<Vec<u8>>,          // Kong's Solana private key (secure storage needed)
    pub sol_rpc_endpoint: Option<String>,          // Solana RPC endpoint URL
    pub sol_network: Option<String>,               // "mainnet-beta" or "devnet"
    pub sol_wsol_address: Option<String>,          // Wrapped SOL token address
    pub sol_token_program_id: Option<String>,      // Solana Token Program ID
    pub sol_system_program_id: Option<String>,     // Solana System Program ID
    pub sol_transaction_timeout_secs: Option<u64>, // Timeout for Solana transactions
}

impl Default for StableKongSettings {
    fn default() -> Self {
        let user_map_idx = USER_MAP.with(|m| m.borrow().iter().map(|(k, _)| k.0).max().unwrap_or(0));
        let token_map_idx = TOKEN_MAP.with(|m| m.borrow().iter().map(|(k, _)| k.0).max().unwrap_or(0));
        let pool_map_idx = POOL_MAP.with(|m| m.borrow().iter().map(|(k, _)| k.0).max().unwrap_or(0));
        let claim_map_idx = CLAIM_MAP.with(|m| m.borrow().iter().map(|(k, _)| k.0).max().unwrap_or(0));
        let lp_token_map_idx = LP_TOKEN_MAP.with(|m| m.borrow().iter().map(|(k, _)| k.0).max().unwrap_or(0));
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
            kong_backend: Account::from(Principal::from_text(KONG_BACKEND).unwrap()),
            kong_data: Principal::from_text(KONG_DATA).unwrap(),
            maintenance_mode: false,
            kingkong: vec![100, 101], // default kingkong users
            ckusdt_token_id: CKUSDT_TOKEN_ID,
            ckusdt_symbol: CKUSDT_SYMBOL.to_string(),
            ckusdt_symbol_with_chain: CKUSDT_SYMBOL_WITH_CHAIN.to_string(),
            ckusdt_address: CKUSDT_ADDRESS.to_string(),
            ckusdt_address_with_chain: CKUSDT_ADDRESS_WITH_CHAIN.to_string(),
            icp_token_id: ICP_TOKEN_ID,
            icp_symbol: ICP_SYMBOL.to_string(),
            icp_symbol_with_chain: ICP_SYMBOL_WITH_CHAIN.to_string(),
            icp_address: ICP_ADDRESS.to_string(),
            icp_address_with_chain: ICP_ADDRESS_WITH_CHAIN.to_string(),
            default_max_slippage: 2.0_f64,
            default_lp_fee_bps: 30,
            default_kong_fee_bps: 0,
            user_map_idx,
            token_map_idx,
            pool_map_idx,
            tx_map_idx,
            request_map_idx,
            transfer_map_idx,
            claim_map_idx,
            lp_token_map_idx,
            claims_interval_secs: 300,                   // claims every 5 minutes
            transfer_expiry_nanosecs: 3_600_000_000_000, // 1 hour (nano seconds)
            requests_archive_interval_secs: 3600,        // archive requests every hour
            txs_archive_interval_secs: 3600,             // archive txs every hour
            transfers_archive_interval_secs: 3600,       // archive transfers every hour
            archive_to_kong_data: false,                 // replicate to kong_data

            // Solana default settings
            sol_enabled: false,                          // Disabled by default
            sol_backend_address: None,                   // Must be set by admin
            sol_private_key: None,                       // Must be set securely by admin
            sol_rpc_endpoint: Some("https://api.mainnet-beta.solana.com".to_string()), // Default mainnet RPC
            sol_network: Some("mainnet-beta".to_string()), // Default to mainnet
            sol_wsol_address: Some("So11111111111111111111111111111111111111112".to_string()), // Wrapped SOL address
            sol_token_program_id: Some("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA".to_string()), // Solana Token Program
            sol_system_program_id: Some("11111111111111111111111111111111".to_string()), // Solana System Program
            sol_transaction_timeout_secs: Some(120),     // 2 minutes timeout
        }
    }
}

// Implementation of Solana-specific methods
impl StableKongSettings {
    // Enable or disable Solana integration
    pub fn set_solana_enabled(&mut self, enabled: bool) {
        self.sol_enabled = enabled;
    }

    // Update Solana backend address (the address that receives funds)
    pub fn set_sol_backend_address(&mut self, address: Option<String>) {
        self.sol_backend_address = address;
    }

    // Update Solana RPC endpoint
    pub fn set_sol_rpc_endpoint(&mut self, endpoint: Option<String>) {
        self.sol_rpc_endpoint = endpoint;
    }

    // Update Solana network (mainnet-beta or devnet)
    pub fn set_sol_network(&mut self, network: Option<String>) {
        self.sol_network = network;
    }

    // Update Wrapped SOL token address
    pub fn set_sol_wsol_address(&mut self, address: Option<String>) {
        self.sol_wsol_address = address;
    }

    // Update Solana token program ID
    pub fn set_sol_token_program_id(&mut self, program_id: Option<String>) {
        self.sol_token_program_id = program_id;
    }

    // Update Solana system program ID
    pub fn set_sol_system_program_id(&mut self, program_id: Option<String>) {
        self.sol_system_program_id = program_id;
    }

    // Update Solana transaction timeout
    pub fn set_sol_transaction_timeout(&mut self, timeout_secs: Option<u64>) {
        self.sol_transaction_timeout_secs = timeout_secs;
    }

    // NEVER expose this function in the public API - should only be used in secure contexts
    // and potentially only during canister initialization
    pub fn set_sol_private_key(&mut self, key: Option<Vec<u8>>) {
        self.sol_private_key = key;
    }

    // Get all Solana settings as a tuple (except private key)
    pub fn get_sol_settings(&self) -> (bool, Option<String>, Option<String>, Option<String>, Option<String>, Option<u64>) {
        (
            self.sol_enabled,
            self.sol_backend_address.clone(),
            self.sol_rpc_endpoint.clone(),
            self.sol_network.clone(),
            self.sol_wsol_address.clone(),
            self.sol_transaction_timeout_secs
        )
    }
}

impl Storable for StableKongSettings {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap_or_default()
    }

    const BOUND: Bound = Bound::Unbounded;
}
