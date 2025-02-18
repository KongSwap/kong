use candid::Nat;
use ic_cdk::query;

use super::remove_liquidity_amounts_reply::RemoveLiquidityAmountsReply;

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
    let token_0 = pool.token_0();
    let chain_0 = token_0.chain();
    let address_0 = token_0.address();
    let symbol_0 = token_0.symbol();
    // Token1
    let token_1 = pool.token_1();
    let chain_1 = token_1.chain();
    let address_1 = token_1.address();
    let symbol_1 = token_1.symbol();

    let (amount_0, lp_fee_0, amount_1, lp_fee_1) = calculate_amounts(&pool, &remove_lp_token_amount)?;

    Ok(RemoveLiquidityAmountsReply {
        symbol,
        chain_0,
        address_0,
        symbol_0,
        amount_0,
        lp_fee_0,
        chain_1,
        address_1,
        symbol_1,
        amount_1,
        lp_fee_1,
        remove_lp_token_amount,
    })
}
