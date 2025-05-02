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

// Constants for conversions
pub const NANOS_PER_SECOND: u64 = 1_000_000_000;

// Market activation threshold - 3000 KONG
// Using a function rather than const due to limitations with non-const From trait
pub fn min_activation_bet() -> TokenAmount {
    TokenAmount::from(3_000_000_000u64)
}
