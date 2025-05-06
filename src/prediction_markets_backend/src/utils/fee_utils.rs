use crate::nat::StorableNat;
use crate::types::TokenAmount;
use crate::constants::{PLATFORM_FEE_PERCENTAGE, calculate_percentage};

/// Calculate platform fee (1%) from the given amount
pub fn calculate_platform_fee(amount: &TokenAmount) -> TokenAmount {
    // Convert to StorableNat first
    let storable_amount = StorableNat::from(amount.to_u64());
    let fee_amount = calculate_percentage(&storable_amount, PLATFORM_FEE_PERCENTAGE);
    TokenAmount::from(fee_amount)
}

/// Calculate remaining amount after platform fee (99%)
pub fn calculate_amount_after_fee(amount: &TokenAmount) -> TokenAmount {
    let fee = calculate_platform_fee(amount);
    amount.clone() - fee
}
