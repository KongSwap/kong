use candid::Nat;
use ic_cdk::query;

use super::add_liquidity_amounts_reply::AddLiquidityAmountsReply;

use crate::ic::guards::not_in_maintenance_mode;
use crate::helpers::nat_helpers::{nat_add, nat_divide, nat_is_zero, nat_multiply, nat_to_decimal_precision};
use crate::stable_lp_token_ledger::lp_token_ledger;
use crate::stable_pool::pool_map;
use crate::stable_token::token::Token;

/// Add liquidity to a pool
///
/// Given an amount of one of the tokens, calculate the amount of the other token to maintain a constant K
///
/// The output of amount_0 and amount_1 should be passed to add_liquidity() to execute the actual transaction
/// Also calculate the amount of LP token user will receive
#[query(guard = "not_in_maintenance_mode")]
fn add_liquidity_amounts(token_0: String, amount: Nat, token_1: String) -> Result<AddLiquidityAmountsReply, String> {
    if let Ok(pool) = pool_map::get_by_tokens(&token_0, &token_1) {
        // Pool
        let symbol = pool.symbol();
        // Token0
        let token_0 = pool.token_0();
        let chain_0 = token_0.chain();
        let symbol_0 = token_0.symbol();
        let address_0 = token_0.address();
        let reserve_0 = nat_add(&pool.balance_0, &pool.lp_fee_0);
        let fee_0 = token_0.fee();
        // Token1
        let token_1 = pool.token_1();
        let chain_1 = token_1.chain();
        let symbol_1 = token_1.symbol();
        let address_1 = token_1.address();
        let reserve_1 = nat_add(&pool.balance_1, &pool.lp_fee_1);
        let fee_1 = token_1.fee();
        // LP token
        let lp_token = pool.lp_token();
        let lp_token_id = lp_token.token_id();
        let lp_total_supply = lp_token_ledger::get_total_supply(lp_token_id);

        if nat_is_zero(&reserve_0) || nat_is_zero(&reserve_1) {
            Err(format!("Zero balances in pool {}", symbol))?
        }

        // amount is amount_0 in this case. calculate amount_1 using amount_0
        // amount_1 = amount_0 * reserve_1 / reserve_0 - for NAT numbers, we need to multiple first and then divide otherwise we lose precision
        // convert amount, reserve_0 to token_1 precision
        let amount_0_in_token_1_decimals = nat_to_decimal_precision(&amount, token_0.decimals(), token_1.decimals());
        let reserve_0_in_token_1_decimals = nat_to_decimal_precision(&reserve_0, token_0.decimals(), token_1.decimals());
        let numerator_in_token_1_decimals = nat_multiply(&amount_0_in_token_1_decimals, &reserve_1);
        let amount_1 = nat_divide(&numerator_in_token_1_decimals, &reserve_0_in_token_1_decimals).ok_or("Invalid amount_1")?;

        // calculate the amount of LP token user will receive
        // add_lp_token_amount = lp_total_supply * amount_0 / reserve_0
        let amount_0_in_lp_token_decimals = nat_to_decimal_precision(&amount, token_0.decimals(), lp_token.decimals());
        let reserve_0_in_lp_token_decimals = nat_to_decimal_precision(&reserve_0, token_0.decimals(), lp_token.decimals());
        let numerator_in_lp_token_decimals = nat_multiply(&lp_total_supply, &amount_0_in_lp_token_decimals);
        let add_lp_token_amount =
            nat_divide(&numerator_in_lp_token_decimals, &reserve_0_in_lp_token_decimals).ok_or("Invalid LP token amount")?;

        return Ok(AddLiquidityAmountsReply {
            symbol,
            chain_0,
            symbol_0,
            address_0,
            amount_0: amount,
            fee_0,
            chain_1,
            symbol_1,
            address_1,
            amount_1,
            fee_1,
            add_lp_token_amount,
        });
    } else if let Ok(pool) = pool_map::get_by_tokens(&token_1, &token_0) {
        let symbol = pool.symbol();
        // Token0
        let token_0 = pool.token_0();
        let chain_0 = token_0.chain();
        let symbol_0 = token_0.symbol();
        let address_0 = token_0.address();
        let reserve_0 = nat_add(&pool.balance_0, &pool.lp_fee_0);
        let fee_0 = token_0.fee();
        // Token1
        let token_1 = pool.token_1();
        let chain_1 = token_1.chain();
        let symbol_1 = token_1.symbol();
        let address_1 = token_1.address();
        let reserve_1 = nat_add(&pool.balance_1, &pool.lp_fee_1);
        let fee_1 = token_1.fee();
        // LP token
        let lp_token = pool.lp_token();
        let lp_token_id = lp_token.token_id();
        let lp_total_supply = lp_token_ledger::get_total_supply(lp_token_id);

        if nat_is_zero(&reserve_0) || nat_is_zero(&reserve_1) {
            Err(format!("Zero balances in pool {}", symbol))?
        }

        // amount is amount_1 in this case. calculate amount_0 using amount_1
        // amount_0 = amount_1 * reserve_0 / reserve_1
        // convert amount, reserve_1 to token_0 precision
        let amount_1_in_token_0_decimals = nat_to_decimal_precision(&amount, token_1.decimals(), token_0.decimals());
        let reserve_1_in_token_0_decimals = nat_to_decimal_precision(&reserve_1, token_1.decimals(), token_0.decimals());
        let numerator_in_token_0_decimals = nat_multiply(&amount_1_in_token_0_decimals, &reserve_0);
        let amount_0 = nat_divide(&numerator_in_token_0_decimals, &reserve_1_in_token_0_decimals).ok_or("Invalid amount_0")?;

        // add_lp_token_amount = lp_total_supply * amount_1 / reserve_1
        let amount_1_in_lp_token_decimals = nat_to_decimal_precision(&amount, token_1.decimals(), lp_token.decimals());
        let reserve_1_in_lp_token_decimals = nat_to_decimal_precision(&reserve_1, token_1.decimals(), lp_token.decimals());
        let numerator_in_lp_token_decimals = nat_multiply(&lp_total_supply, &amount_1_in_lp_token_decimals);
        let add_lp_token_amount =
            nat_divide(&numerator_in_lp_token_decimals, &reserve_1_in_lp_token_decimals).ok_or("Invalid LP token amount")?;

        return Ok(AddLiquidityAmountsReply {
            symbol,
            chain_0,
            symbol_0,
            address_0,
            amount_0,
            fee_0,
            chain_1,
            symbol_1,
            address_1,
            amount_1: amount,
            fee_1,
            add_lp_token_amount,
        });
    }

    Err("Pool not found".to_string())
}
