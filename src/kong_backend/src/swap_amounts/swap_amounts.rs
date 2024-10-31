use candid::Nat;
use ic_cdk::query;

use super::swap_amounts_reply::SwapAmountsReply;
use super::swap_amounts_reply_impl::to_swap_amounts_tx_reply;

use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_token::token::Token;
use crate::stable_token::token_map;
use crate::swap;

#[query(guard = "not_in_maintenance_mode")]
pub fn swap_amounts(pay_token: String, pay_amount: Nat, receive_token: String) -> Result<SwapAmountsReply, String> {
    // Pay token
    let pay_token = token_map::get_by_token(&pay_token)?;
    let pay_chain = pay_token.chain();
    let pay_symbol = pay_token.symbol();
    let pay_address = pay_token.address();
    // Receive token
    let receive_token = token_map::get_by_token(&receive_token)?;
    let receive_chain = receive_token.chain();
    let receive_symbol = receive_token.symbol();
    let receive_address = receive_token.address();

    let (receive_amount, price, mid_price, slippage, txs) = swap::swap_amounts::swap_amounts(&pay_token, &pay_amount, &receive_token)?;
    let mut swap_amounts_tx_reply = Vec::new();
    txs.iter().for_each(|tx| {
        if let Some(tx_reply) = to_swap_amounts_tx_reply(tx) {
            swap_amounts_tx_reply.push(tx_reply);
        }
    });

    Ok(SwapAmountsReply {
        pay_chain,
        pay_symbol,
        pay_amount,
        pay_address,
        receive_chain,
        receive_symbol,
        receive_address,
        receive_amount,
        price,
        mid_price,
        slippage,
        txs: swap_amounts_tx_reply,
    })
}
