use candid::Nat;
use ic_cdk::query;

use super::remove_liquidity_amounts_reply::RemoveLiquidityAmountsReply;

use crate::helpers::nat_helpers::{nat_add, nat_zero};
use crate::ic::guards::not_in_maintenance_mode;
use crate::remove_liquidity::remove_liquidity::calculate_amounts;
use crate::stable_pool::pool_map;
use crate::stable_token::token::Token;

#[query(guard = "not_in_maintenance_mode")]
fn remove_liquidity_amounts(token_0: String, token_1: String, remove_lp_token_amount: Nat) -> Result<RemoveLiquidityAmountsReply, String> {
    // Pool
    let pool = pool_map::get_by_tokens(&token_0, &token_1)?;
    let symbol = pool.symbol();
    // Token0
    let token_0_obj = pool.token_0(); // Renamed to avoid conflict
    let chain_0 = token_0_obj.chain();
    let address_0 = token_0_obj.address();
    let symbol_0 = token_0_obj.symbol();
    // Token1
    let token_1_obj = pool.token_1(); // Renamed to avoid conflict
    let chain_1 = token_1_obj.chain();
    let address_1 = token_1_obj.address();
    let symbol_1 = token_1_obj.symbol();

    let (calculated_amount_0, calculated_lp_fee_0, calculated_amount_1, calculated_lp_fee_1) =
        calculate_amounts(&pool, &remove_lp_token_amount)?;

    let final_amount_0 = nat_add(&calculated_amount_0, &calculated_lp_fee_0);
    let final_amount_1 = nat_add(&calculated_amount_1, &calculated_lp_fee_1);

    Ok(RemoveLiquidityAmountsReply {
        symbol,
        chain_0,
        address_0,
        symbol_0,
        amount_0: final_amount_0,
        lp_fee_0: nat_zero(), // Fees are now included in amount_0
        chain_1,
        address_1,
        symbol_1,
        amount_1: final_amount_1,
        lp_fee_1: nat_zero(), // Fees are now included in amount_1
        remove_lp_token_amount,
    })
}
