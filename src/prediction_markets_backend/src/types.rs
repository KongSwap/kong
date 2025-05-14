// Central type definitions for the prediction markets backend
// This module consolidates all common types to ensure consistency

// Re-export StorableNat for convenience
pub use crate::nat::StorableNat;

// Core type aliases
pub type MarketId = StorableNat;
pub type Timestamp = StorableNat;
pub type TokenAmount = StorableNat;
pub type OutcomeIndex = StorableNat;
pub type PoolAmount = StorableNat;
pub type BetCount = StorableNat;
pub type AccountIdentifier = candid::Principal;
// Token identifier is defined in registry, but we re-export it here
pub type TokenIdentifier = String;

// Constants for conversions
pub const NANOS_PER_SECOND: u64 = 1_000_000_000;

// Market activation threshold - different for each token type
// Using a function rather than const due to limitations with non-const From trait
pub fn min_activation_bet(token_id: &TokenIdentifier) -> TokenAmount {
    // Default value for KONG remains 3000 KONG (with 8 decimals)
    let default_amount = TokenAmount::from(300_000_000_000u64);
    
    // Get token info
    let token_info = match crate::token::registry::get_token_info(token_id) {
        Some(info) => info,
        None => return default_amount, // If token not found, use default
    };
    
    // Set token-specific activation fees
    match token_info.symbol.as_str() {
        "KONG" => TokenAmount::from(300_000_000u64), // 3000 KONG (8 decimals)
        "ICP" | "ksICP" => TokenAmount::from(2_500_000_000u64), // 25 ICP (8 decimals)
        "ckUSDT" => TokenAmount::from(100_000_000u64), // 100 ckUSDT (6 decimals)
        "ckUSDC" => TokenAmount::from(100_000_000u64), // 100 ckUSDC (6 decimals)
        "ckBTC" => TokenAmount::from(100_000u64), // 0.001 ckBTC (8 decimals)
        "DKP" => TokenAmount::from(7_000_000_000_000u64), // 70000 DKP (8 decimals)
        "GLDT" => TokenAmount::from(10_000_000_000u64), // 100 GLDT (8 decimals)
        _ => default_amount // Default to 3000 KONG equivalent for unknown tokens
    }
}

// Utility function to calculate platform fee based on token and amount
pub fn calculate_platform_fee(amount: &TokenAmount, token_id: &TokenIdentifier) -> TokenAmount {
    let token_info = match crate::token::registry::get_token_info(token_id) {
        Some(info) => info,
        None => return TokenAmount::from(0u64), // If token not found, no fee
    };

    let fee_percentage = token_info.fee_percentage;
    let amount_u64 = amount.to_u64();
    let fee_amount = amount_u64 * fee_percentage / 10000; // fee_percentage is in basis points (100 = 1%)
    
    TokenAmount::from(fee_amount)
}
