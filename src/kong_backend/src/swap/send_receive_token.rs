use candid::Nat;
use transfer_lib::solana::send_info::SendInfo;

use super::swap_calc::SwapCalc;
use super::swap_reply::SwapReply;
use super::swap_reply_helpers::{to_swap_reply, to_swap_reply_failed};
use crate::stable_claim::claim_map;
use kong_lib::stable_claim::stable_claim::StableClaim;
use crate::stable_request::{reply::Reply, request_map, status::StatusCode};
use crate::stable_tx::{stable_tx::StableTx, swap_tx::SwapTx, tx_map};
use kong_lib::ic::address::Address;
use kong_lib::stable_token::{stable_token::StableToken, token::Token};

#[allow(clippy::too_many_arguments)]
pub async fn send_receive_token(
    request_id: u64,
    user_id: u32,
    pay_token: &StableToken,
    pay_amount: &Nat,
    receive_token: &StableToken,
    receive_amount: &Nat,
    to_address: &Address,
    transfer_ids: &mut Vec<u64>,
    mid_price: f64,
    price: f64,
    slippage: f64,
    txs: &[SwapCalc],
    ts: u64,
) -> SwapReply {
    let pay_token_id = pay_token.token_id();
    let receive_token_id = receive_token.token_id();

    let mut claim_ids = Vec::new();

    request_map::update_status(request_id, StatusCode::SendReceiveToken, None);

    let send_info = SendInfo { request_id, user_id, ts: Some(ts) };
    match transfer_lib::send::send(receive_token, to_address, receive_amount, send_info).await {
        Ok(_) => {
            request_map::update_status(request_id, StatusCode::SendReceiveTokenSuccess, None);
        }
        Err(e) => {
            let claim = StableClaim::new(
                user_id,
                receive_token_id,
                receive_amount,
                Some(request_id),
                Some(to_address.clone()),
                ts,
            );
            let claim_id = claim_map::insert(&claim);
            claim_ids.push(claim_id);
            request_map::update_status(
                request_id,
                StatusCode::SendReceiveTokenFailed,
                Some(&format!("Saved as claim #{}. {}", claim_id, e)),
            );
        }
    }

    let swap_tx = SwapTx::new_success(
        user_id,
        request_id,
        pay_token_id,
        pay_amount,
        receive_token_id,
        receive_amount,
        mid_price,
        price,
        slippage,
        txs,
        transfer_ids,
        &claim_ids,
        ts,
    );
    let tx_id = tx_map::insert(&StableTx::Swap(swap_tx.clone()));
    let reply = match tx_map::get_by_user_and_token_id(Some(tx_id), None, None, None).first() {
        Some(StableTx::Swap(swap_tx)) => to_swap_reply(swap_tx),
        _ => to_swap_reply_failed(request_id, pay_token, pay_amount, Some(receive_token), transfer_ids, &claim_ids, ts),
    };
    request_map::update_reply(request_id, Reply::Swap(reply.clone()));

    reply
}
