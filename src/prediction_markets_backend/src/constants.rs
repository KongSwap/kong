use crate::nat::StorableNat;

/// Platform fee as a percentage (1%)
pub const PLATFORM_FEE_PERCENTAGE: u64 = 1;

/// Get platform fee as StorableNat for consistency
pub fn platform_fee_percentage() -> StorableNat {
    StorableNat::from(PLATFORM_FEE_PERCENTAGE)
}

/// Helper to calculate percentage of an amount
pub fn calculate_percentage(amount: &StorableNat, percentage: u64) -> StorableNat {
    let percentage_nat = StorableNat::from(percentage);
    let hundred = 100u64;
    
    // Convert StorableNat to u64, perform division, then convert back
    let result = (amount.to_u64() * percentage) / hundred;
    StorableNat::from(result)
}
