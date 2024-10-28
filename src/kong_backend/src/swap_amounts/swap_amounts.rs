use candid::Nat;
use ic_cdk::query;

use super::swap_amounts_reply::SwapAmountsReply;
use super::swap_amounts_reply_impl::to_swap_amounts_tx_reply;

use crate::helpers::math_helpers::price_rounded;
use crate::helpers::nat_helpers::nat_zero;
use crate::ic::{ckusdt::is_ckusdt, guards::not_in_maintenance_mode, icp::is_icp};
use crate::stable_pool::pool_map;
use crate::stable_token::token::Token;
use crate::stable_token::token_map;
use crate::stable_user::user_map;
use crate::swap::swap_calc_impl::{get_slippage, swap_amount_0, swap_amount_1};

#[query(guard = "not_in_maintenance_mode")]
pub fn swap_amounts(pay_token: String, pay_amount: Nat, receive_token: String) -> Result<SwapAmountsReply, String> {
    // Pay token
    let pay_token = token_map::get_by_token(&pay_token)?;
    let pay_token_id = pay_token.token_id();
    // Receive token
    let receive_token = token_map::get_by_token(&receive_token)?;
    let receive_token_id = receive_token.token_id();
    let ckusdt = token_map::get_ckusdt()?;
    let user_fee_level = user_map::get_by_caller().ok().flatten().unwrap_or_default().fee_level;

    let mut txs = Vec::new();
    if is_ckusdt(&receive_token.address_with_chain()) {
        let pool = pool_map::get_by_token_ids(pay_token_id, receive_token_id).ok_or("Pool not found")?;
        let swap = swap_amount_0(&pool, &pay_amount, Some(user_fee_level), None, None)?;
        txs.push(to_swap_amounts_tx_reply(&swap).ok_or("Invalid swap tokens")?);
        let pay_chain = pay_token.chain();
        let pay_symbol = pay_token.symbol();
        let pay_address = pay_token.address();
        let receive_chain = receive_token.chain();
        let receive_symbol = receive_token.symbol();
        let receive_address = receive_token.address();
        let mid_price = swap.get_mid_price().ok_or("Invalid mid price")?;
        let mid_price_f64 = price_rounded(&mid_price).ok_or("Invalid mid price")?;
        let price = swap.get_price().ok_or("Invalid price")?;
        let price_f64 = price_rounded(&price).ok_or("Invalid price")?;
        let slippage_f64 = get_slippage(&price, &mid_price).ok_or("Invalid slippage")?;
        Ok(SwapAmountsReply {
            pay_chain,
            pay_symbol,
            pay_amount,
            pay_address,
            receive_chain,
            receive_symbol,
            receive_address,
            receive_amount: swap.receive_amount_with_fees_and_gas(),
            price: price_f64,
            txs,
            mid_price: mid_price_f64,
            slippage: slippage_f64,
        })
    } else if is_ckusdt(&pay_token.address_with_chain()) {
        let pool = pool_map::get_by_token_ids(receive_token_id, pay_token_id).ok_or("Pool not found")?;
        let swap = swap_amount_1(&pool, &pay_amount, Some(user_fee_level), None, None)?;
        txs.push(to_swap_amounts_tx_reply(&swap).ok_or("Invalid swap tokens")?);
        let pay_chain = pay_token.chain();
        let pay_symbol = pay_token.symbol();
        let pay_address = pay_token.address();
        let receive_chain = receive_token.chain();
        let receive_symbol = receive_token.symbol();
        let receive_address = receive_token.address();
        let mid_price = swap.get_mid_price().ok_or("Invalid mid price")?;
        let mid_price_f64 = price_rounded(&mid_price).ok_or("Invalid mid price")?;
        let price = swap.get_price().ok_or("Invalid price")?;
        let price_f64 = price_rounded(&price).ok_or("Invalid price")?;
        let slippage_f64 = get_slippage(&price, &mid_price).ok_or("Invalid slippage")?;
        Ok(SwapAmountsReply {
            pay_chain,
            pay_symbol,
            pay_address,
            pay_amount,
            receive_chain,
            receive_symbol,
            receive_address,
            receive_amount: swap.receive_amount_with_fees_and_gas(),
            price: price_f64,
            txs,
            mid_price: mid_price_f64,
            slippage: slippage_f64,
        })
    } else {
        // 2-step swap via ckUSDT
        let pool1 = pool_map::get_by_token_ids(pay_token_id, ckusdt.token_id()).ok_or("Pool not found")?;
        let swap1_lp_fee = (pool1.lp_fee_bps + 1) / 2; // this will round it up
        let swap1 = swap_amount_0(
            &pool1,
            &pay_amount,
            Some(user_fee_level),
            Some(swap1_lp_fee),
            Some(&nat_zero()), // swap1 do not take gas fees
        )?;
        txs.push(to_swap_amounts_tx_reply(&swap1).ok_or("Invalid swap tokens")?);
        let pool2 = pool_map::get_by_token_ids(receive_token_id, ckusdt.token_id()).ok_or("Pool not found")?;
        let swap2_lp_fee = (pool2.lp_fee_bps + 1) / 2;
        let swap2 = swap_amount_1(
            &pool2,
            &swap1.receive_amount_with_fees_and_gas(),
            Some(user_fee_level),
            Some(swap2_lp_fee),
            None,
        )?;
        txs.push(to_swap_amounts_tx_reply(&swap2).ok_or("Invalid swap tokens")?);
        let pay_chain = pay_token.chain();
        let pay_symbol = pay_token.symbol();
        let pay_address = pay_token.address();
        let receive_chain = receive_token.chain();
        let receive_symbol = receive_token.symbol();
        let receive_address = receive_token.address();
        // calculate using swap1.price * swap2.price in case amount is zero
        let swap1_mid_price = swap1.get_mid_price().ok_or("Invalid swap1 mid price")?;
        let swap2_mid_price = swap2.get_mid_price().ok_or("Invalid swap2 mid price")?;
        let mid_price = swap1_mid_price * swap2_mid_price;
        let mid_price_f64 = price_rounded(&mid_price).ok_or("Invalid mid price")?;
        let swap1_price = swap1.get_price().ok_or("Invalid swap1 price")?;
        let swap2_price = swap2.get_price().ok_or("Invalid swap2 price")?;
        let price = swap1_price * swap2_price;
        let price_f64 = price_rounded(&price).ok_or("Invalid price")?;
        let slippage_f64 = get_slippage(&price, &mid_price).ok_or("Invalid slippage")?;
        Ok(SwapAmountsReply {
            pay_chain,
            pay_symbol,
            pay_address,
            pay_amount,
            receive_chain,
            receive_symbol,
            receive_address,
            receive_amount: swap2.receive_amount_with_fees_and_gas(),
            price: price_f64,
            txs,
            mid_price: mid_price_f64,
            slippage: slippage_f64,
        })
    }
}
