use candid::{CandidType, Deserialize, Principal};
use std::cell::RefCell;
use std::collections::HashMap;
use serde::Serialize;

use crate::types::{TokenAmount, StorableNat};

/// Token identifier type
pub type TokenIdentifier = String;

/// Structure to represent token metadata
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct TokenInfo {
    pub id: TokenIdentifier,           // Canister ID of the token
    pub name: String,                  // Human-readable name
    pub symbol: String,                // Token symbol
    pub decimals: u8,                  // Token decimal places
    pub fee_percentage: u64,           // Fee percentage (1% = 100, 2% = 200)
    pub is_kong: bool,                 // Whether this is the KONG token
    pub transfer_fee: TokenAmount,     // Transfer fee for this token
}

// Thread-local registry of supported tokens
thread_local! {
    static TOKEN_REGISTRY: RefCell<HashMap<TokenIdentifier, TokenInfo>> = RefCell::new({
        let mut registry = HashMap::new();
        
        // Add KONG token
        registry.insert(
            "umunu-kh777-77774-qaaca-cai".to_string(), 
            TokenInfo {
                id: "umunu-kh777-77774-qaaca-cai".to_string(),
                name: "Kong Swap Token".to_string(),
                symbol: "KONG".to_string(),
                decimals: 8,
                fee_percentage: 100, // 1%
                is_kong: true,
                transfer_fee: StorableNat::from(10_000u64), // 0.0001 KONG
            }
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
                transfer_fee: StorableNat::from(1_000u64), // 0.001 USDT
            }
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
                transfer_fee: StorableNat::from(10_000u64), // 0.0001 ICP
            }
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
                transfer_fee: StorableNat::from(1_000u64), // 0.001 USDT
            }
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
                transfer_fee: StorableNat::from(1_000u64), // 0.001 USDC
            }
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
                transfer_fee: StorableNat::from(10u64), // 0.0000001 BTC
            }
        );
        
        // Add DKP token
        registry.insert(
            "zfcdd-tqaaa-aaaaq-aaaga-cai".to_string(),
            TokenInfo {
                id: "zfcdd-tqaaa-aaaaq-aaaga-cai".to_string(),
                name: "DANK Protocol".to_string(),
                symbol: "DKP".to_string(),
                decimals: 8,
                fee_percentage: 200, // 2%
                is_kong: false,
                transfer_fee: StorableNat::from(10_000u64), // 0.0001 DKP
            }
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
                transfer_fee: StorableNat::from(10_000u64), // 0.0001 GLDT
            }
        );
        
        // Note: EXE token is excluded as requested
        
        registry
    });
}

// Functions to interact with the token registry
pub fn get_token_info(token_id: &TokenIdentifier) -> Option<TokenInfo> {
    TOKEN_REGISTRY.with(|registry| {
        registry.borrow().get(token_id).cloned()
    })
}

pub fn is_supported_token(token_id: &TokenIdentifier) -> bool {
    TOKEN_REGISTRY.with(|registry| {
        registry.borrow().contains_key(token_id)
    })
}

pub fn get_all_supported_tokens() -> Vec<TokenInfo> {
    TOKEN_REGISTRY.with(|registry| {
        registry.borrow().values().cloned().collect()
    })
}

// For admin to add new supported tokens
pub fn add_supported_token(token_info: TokenInfo) {
    TOKEN_REGISTRY.with(|registry| {
        registry.borrow_mut().insert(token_info.id.clone(), token_info);
    });
}

// For admin to update an existing token configuration
pub fn update_token_config(token_info: TokenInfo) {
    TOKEN_REGISTRY.with(|registry| {
        let mut registry_ref = registry.borrow_mut();
        if registry_ref.contains_key(&token_info.id) {
            registry_ref.insert(token_info.id.clone(), token_info);
        }
    });
}

// For admin to remove supported tokens
pub fn remove_supported_token(token_id: TokenIdentifier) {
    TOKEN_REGISTRY.with(|registry| {
        registry.borrow_mut().remove(&token_id);
    });
}

// Constants for production vs local environments
pub const KONG_LEDGER_ID_PROD: &str = "o7oak-iyaaa-aaaaq-aadzq-cai";  // Production KONG
pub const KONG_LEDGER_ID_LOCAL: &str = "umunu-kh777-77774-qaaca-cai";  // Local testing KONG
