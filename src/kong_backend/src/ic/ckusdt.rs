use candid::Nat;

use crate::helpers::nat_helpers::nat_to_decimals_f64;
use crate::stable_kong_settings::kong_settings_map;
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::token::Token;
use crate::stable_token::token_map;
use crate::swap::swap_amounts::swap_mid_amounts;

pub const CKUSDT_TOKEN_ID: u32 = 1;
pub const CKUSDT_SYMBOL: &str = "ckUSDT";
pub const CKUSDT_SYMBOL_WITH_CHAIN: &str = "IC.ckUSDT";
pub const CKUSDT_ADDRESS: &str = "cngnf-vqaaa-aaaar-qag4q-cai";
pub const CKUSDT_ADDRESS_WITH_CHAIN: &str = "IC.cngnf-vqaaa-aaaar-qag4q-cai";

pub fn is_ckusdt(token: &str) -> bool {
    let kong_settings = kong_settings_map::get();
    if token == kong_settings.ckusdt_symbol
        || token == kong_settings.ckusdt_symbol_with_chain
        || token == kong_settings.ckusdt_address
        || token == kong_settings.ckusdt_address_with_chain
    {
        return true;
    }
    false
}

/// Calculate the ckusdt amount for a given token and amount
pub fn ckusdt_amount(token: &StableToken, amount: &Nat) -> Result<Nat, String> {
    let ckusdt_token = token_map::get_ckusdt()?;
    let receive_amount = swap_mid_amounts(token, amount, &ckusdt_token)?;
    Ok(receive_amount)
}

/// Convert a Nat amount to a f64 with the correct number of decimals for ckUSDT
pub fn to_ckusdt_decimals_f64(amount: &Nat) -> Option<f64> {
    let ckusdt = token_map::get_ckusdt().ok()?;
    let decimals = ckusdt.decimals();
    nat_to_decimals_f64(decimals, amount)
}
