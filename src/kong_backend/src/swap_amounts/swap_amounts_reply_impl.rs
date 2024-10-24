use num::{BigRational, Zero};

use super::swap_amounts_reply::SwapAmountsTxReply;

use crate::stable_token::token::Token;
use crate::stable_token::token_map;
use crate::swap::swap_calc::SwapCalc;
use crate::{helpers::math_helpers::price_rounded, stable_pool::pool_map};

pub fn to_swap_amounts_tx_reply(swap: &SwapCalc) -> Option<SwapAmountsTxReply> {
    let pool = pool_map::get_by_pool_id(swap.pool_id)?;
    let pay_token = token_map::get_by_token_id(swap.pay_token_id)?;
    let pay_chain = pay_token.chain();
    let pay_symbol = pay_token.symbol();
    let pay_address = pay_token.address();
    let receive_token = token_map::get_by_token_id(swap.receive_token_id)?;
    let receive_chain = receive_token.chain();
    let receive_symbol = receive_token.symbol();
    let receive_address = receive_token.address();
    let price = swap.get_price().unwrap_or(BigRational::zero());
    let price_f64 = price_rounded(&price).unwrap_or(0_f64);
    Some(SwapAmountsTxReply {
        pool_symbol: pool.symbol(),
        pay_chain,
        pay_symbol,
        pay_address,
        pay_amount: swap.pay_amount.clone(),
        receive_chain,
        receive_symbol,
        receive_address,
        receive_amount: swap.receive_amount_with_fees_and_gas(),
        price: price_f64,
        lp_fee: swap.lp_fee.clone(),
        gas_fee: swap.gas_fee.clone(),
    })
}
