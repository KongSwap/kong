//! # Token Registry Module
//!
//! This module manages the configuration and registration of all tokens supported by the
//! Kong Swap prediction markets platform. It provides a centralized registry of token metadata,
//! including fee structures, decimal places, and transfer fees.
//!
//! The token registry supports:
//! - Multiple token types (KONG, ICP, ckBTC, ckUSDT, etc.)
//! - Different fee structures per token
//! - Special handling for the native KONG token
//! - Dynamic addition and removal of supported tokens
//!
//! Each token has specific configuration parameters that control how it behaves
//! in the prediction markets system, including fee calculations and minimum
//! transfer amounts.

use candid::{CandidType, Deserialize};
use ic_stable_structures::{storable::Bound, Storable};
use serde::Serialize;
use std::borrow::Cow;
use std::cell::RefCell;
use std::collections::HashMap;

use crate::types::{StorableNat, TokenAmount};

/// Token identifier type, represented as a canister Principal ID in string form
///
/// This type is used to identify tokens throughout the system. It corresponds to
/// the canister ID of the token's ledger canister on the Internet Computer.
pub type TokenIdentifier = String;

/// Structure to represent token metadata and configuration parameters
///
/// This structure defines all the properties and configuration values for a token
/// supported by the Kong Swap platform. It includes both display information (name, symbol)
/// and operational parameters (fee structure, decimal places).
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct TokenInfo {
    /// Canister ID of the token's ledger on the Internet Computer
    /// This is the unique identifier for the token and must match the actual canister ID
    pub id: TokenIdentifier,

    /// Human-readable name of the token (e.g., "Kong Swap Token")
    /// Used primarily for UI display and logs
    pub name: String,

    /// Token symbol (e.g., "KONG", "ICP", "ckBTC")
    /// Used for display in the UI and logs
    pub symbol: String,

    /// Number of decimal places used by this token
    /// Critical for proper amount formatting and arithmetic operations
    /// For example: 8 for KONG/ICP/BTC (1 token = 10^8 units), 6 for USDT/USDC
    pub decimals: u8,

    /// Platform fee percentage in basis points (1% = 100, 2% = 200)
    /// Used to calculate the fee taken from market profits
    /// KONG has a reduced fee (1%) compared to other tokens (2%)
    pub fee_percentage: u64,

    /// Whether this is the KONG token (native platform token)
    /// KONG tokens receive special treatment (e.g., fees are burned rather than collected)
    pub is_kong: bool,

    /// Expected transfer fee
    /// Claims with amount less than this value should not be created
    /// This is deducted from transfers and ensures the minimum viable transaction amount
    /// Example: 10_000 (0.0001 KONG) for KONG tokens, 1_000 (0.001 USDT) for ckUSDT
    pub transfer_fee: TokenAmount,

    /// Minimum amount required to activate a market with this token
    /// This defines the threshold that must be met before a market becomes active
    /// Examples: 3000 KONG (300_000_000_000 units), 25 ICP (2_500_000_000 units)
    pub activation_fee: TokenAmount,
}

impl Storable for TokenInfo {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_json::to_vec(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_json::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

// Thread-local registry of supported tokens
thread_local! {
    static TOKEN_REGISTRY: RefCell<HashMap<TokenIdentifier, TokenInfo>> = RefCell::new(HashMap::new());
}

pub fn init() {
    TOKEN_REGISTRY.with(|registry| {
        let mut registry = registry.borrow_mut();

        // Add KONG token
        registry.insert(
            "o7oak-iyaaa-aaaaq-aadzq-cai".to_string(),
            TokenInfo {
                id: "o7oak-iyaaa-aaaaq-aadzq-cai".to_string(),
                name: "Kong Swap Token".to_string(),
                symbol: "KONG".to_string(),
                decimals: 8,
                fee_percentage: 100, // 1%
                is_kong: true,
                transfer_fee: StorableNat::from(10_000u64),            // 0.0001 KONG
                activation_fee: StorableNat::from(300_000_000_000u64), // 3000 KONG
            },
        );

        // Add PocketIC KONG token
        registry.insert(
            "lxzze-o7777-77777-aaaaa-cai".to_string(),
            TokenInfo {
                id: "lxzze-o7777-77777-aaaaa-cai".to_string(),
                name: "PocketIC KONG".to_string(),
                symbol: "KONG".to_string(),
                decimals: 8,
                fee_percentage: 100, // 1%
                is_kong: true,
                transfer_fee: StorableNat::from(10_000u64),            // 0.0001 KONG
                activation_fee: StorableNat::from(300_000_000_000u64), // 3000 KONG
            },
        );

        // Add ksUSDT token for local testing
        registry.insert(
            "v56tl-sp777-77774-qaahq-cai".to_string(),
            TokenInfo {
                id: "v56tl-sp777-77774-qaahq-cai".to_string(),
                name: "Chain Key USDT".to_string(),
                symbol: "ksUSDT".to_string(),
                decimals: 6,
                fee_percentage: 200, // 2%
                is_kong: false,
                transfer_fee: StorableNat::from(1_000u64),         // 0.001 USDT
                activation_fee: StorableNat::from(100_000_000u64), // 100 ksUSDT
            },
        );

        // Add production ICP token
        registry.insert(
            "ryjl3-tyaaa-aaaaa-aaaba-cai".to_string(),
            TokenInfo {
                id: "ryjl3-tyaaa-aaaaa-aaaba-cai".to_string(),
                name: "Internet Computer Protocol".to_string(),
                symbol: "ICP".to_string(),
                decimals: 8,
                fee_percentage: 200, // 2%
                is_kong: false,
                transfer_fee: StorableNat::from(10_000u64),          // 0.0001 ICP
                activation_fee: StorableNat::from(2_500_000_000u64), // 25 ICP
            },
        );

        // Add ckUSDT token
        registry.insert(
            "cngnf-vqaaa-aaaar-qag4q-cai".to_string(),
            TokenInfo {
                id: "cngnf-vqaaa-aaaar-qag4q-cai".to_string(),
                name: "Chain Key USDT".to_string(),
                symbol: "ckUSDT".to_string(),
                decimals: 6,
                fee_percentage: 200, // 2%
                is_kong: false,
                transfer_fee: StorableNat::from(1_000u64),         // 0.001 USDT
                activation_fee: StorableNat::from(100_000_000u64), // 100 ckUSDT
            },
        );

        // Add ckUSDC token
        registry.insert(
            "xevnm-gaaaa-aaaar-qafnq-cai".to_string(),
            TokenInfo {
                id: "xevnm-gaaaa-aaaar-qafnq-cai".to_string(),
                name: "Chain Key USDC".to_string(),
                symbol: "ckUSDC".to_string(),
                decimals: 6,
                fee_percentage: 200, // 2%
                is_kong: false,
                transfer_fee: StorableNat::from(1_000u64),         // 0.001 USDC
                activation_fee: StorableNat::from(100_000_000u64), // 100 ckUSDC
            },
        );

        // Add ckBTC token
        registry.insert(
            "mxzaz-hqaaa-aaaar-qaada-cai".to_string(),
            TokenInfo {
                id: "mxzaz-hqaaa-aaaar-qaada-cai".to_string(),
                name: "Chain Key BTC".to_string(),
                symbol: "ckBTC".to_string(),
                decimals: 8,
                fee_percentage: 200, // 2%
                is_kong: false,
                transfer_fee: StorableNat::from(10u64),        // 0.0000001 BTC
                activation_fee: StorableNat::from(100_000u64), // 0.001 ckBTC
            },
        );

        // Add DKP token
        registry.insert(
            "zfcdd-tqaaa-aaaaq-aaaga-cai".to_string(),
            TokenInfo {
                id: "zfcdd-tqaaa-aaaaq-aaaga-cai".to_string(),
                name: "Draggin Karma Points".to_string(),
                symbol: "DKP".to_string(),
                decimals: 8,
                fee_percentage: 200, // 2%
                is_kong: false,
                transfer_fee: StorableNat::from(10_000u64),              // 0.0001 DKP
                activation_fee: StorableNat::from(7_000_000_000_000u64), // 70000 DKP
            },
        );

        // Add GLDT token
        registry.insert(
            "6c7su-kiaaa-aaaar-qaira-cai".to_string(),
            TokenInfo {
                id: "6c7su-kiaaa-aaaar-qaira-cai".to_string(),
                name: "Gold Token".to_string(),
                symbol: "GLDT".to_string(),
                decimals: 8,
                fee_percentage: 200, // 2%
                is_kong: false,
                transfer_fee: StorableNat::from(1_000u64),            // 0.00001 GLDT
                activation_fee: StorableNat::from(10_000_000_000u64), // 100 GLDT
            },
        );

        // Note: EXE token is excluded as requested
    });
}

/// Functions to interact with the token registry

/// Retrieves the configuration information for a specific token
///
/// This function looks up a token by its identifier (canister ID) and returns
/// its full configuration if found, or None if the token is not supported.
///
/// # Parameters
/// * `token_id` - The canister ID of the token to look up
///
/// # Returns
/// * `Option<TokenInfo>` - Token configuration if found, None otherwise
pub fn get_token_info(token_id: &TokenIdentifier) -> Option<TokenInfo> {
    TOKEN_REGISTRY.with(|registry| registry.borrow().get(token_id).cloned())
}

/// Checks if a token is supported by the platform
///
/// This function verifies whether a token with the given ID is registered
/// and available for use in prediction markets.
///
/// # Parameters
/// * `token_id` - The canister ID of the token to check
///
/// # Returns
/// * `bool` - True if the token is supported, false otherwise
pub fn is_supported_token(token_id: &TokenIdentifier) -> bool {
    TOKEN_REGISTRY.with(|registry| registry.borrow().contains_key(token_id))
}

/// Retrieves configuration information for all supported tokens
///
/// This function returns a list of all tokens currently registered in the system,
/// including their complete configuration details. Used for UI display and administrative purposes.
///
/// # Returns
/// * `Vec<TokenInfo>` - List of all supported token configurations
pub fn get_all_supported_tokens() -> Vec<TokenInfo> {
    TOKEN_REGISTRY.with(|registry| registry.borrow().values().cloned().collect())
}

/// Gets a list of all supported token identifiers (canister IDs)
///
/// This function returns just the canister IDs of all supported tokens without
/// the full configuration details. Useful for validation and UI requirements.
///
/// # Returns
/// * `Vec<TokenIdentifier>` - List of all supported token canister IDs
pub fn get_supported_token_identifiers() -> Vec<TokenIdentifier> {
    TOKEN_REGISTRY.with(|registry| registry.borrow().keys().cloned().collect())
}

/// Adds a new token to the supported tokens registry (admin only)
///
/// This function registers a new token for use in the prediction markets platform.
/// It requires administrative access and should be called through a proper
/// admin-controlled interface.
///
/// # Parameters
/// * `token_info` - Complete token configuration including ID, name, symbol, and fee structure
///
/// # Security
/// This function must only be callable by canister administrators
pub fn add_supported_token(token_info: TokenInfo) {
    TOKEN_REGISTRY.with(|registry| {
        registry.borrow_mut().insert(token_info.id.clone(), token_info);
    });
}

/// Updates the configuration of an existing supported token (admin only)
///
/// This function allows administrators to modify the parameters of a token
/// that is already registered in the system. For example, to adjust the fee
/// percentage or transfer fee.
///
/// # Parameters
/// * `token_info` - Updated token configuration
///
/// # Behavior
/// Only updates the token if it already exists in the registry
///
/// # Security
/// This function must only be callable by canister administrators
pub fn update_token_config(token_info: TokenInfo) {
    TOKEN_REGISTRY.with(|registry| {
        let mut registry_ref = registry.borrow_mut();
        if registry_ref.contains_key(&token_info.id) {
            registry_ref.insert(token_info.id.clone(), token_info);
        }
    });
}

/// Removes a token from the supported tokens registry (admin only)
///
/// This function deregisters a token from the system, preventing it from
/// being used in new prediction markets. Existing markets using this token
/// should be handled carefully.
///
/// # Parameters
/// * `token_id` - Canister ID of the token to be removed
///
/// # Security
/// This function must only be callable by canister administrators
pub fn remove_supported_token(token_id: TokenIdentifier) {
    TOKEN_REGISTRY.with(|registry| {
        registry.borrow_mut().remove(&token_id);
    });
}

/// Constants for production vs local environments

/// Canister ID for the KONG token ledger in production environment
pub const KONG_LEDGER_ID_PROD: &str = "o7oak-iyaaa-aaaaq-aadzq-cai";

/// Canister ID for the KONG token ledger in local testing environment
pub const KONG_LEDGER_ID_LOCAL: &str = "o7oak-iyaaa-aaaaq-aadzq-cai";
