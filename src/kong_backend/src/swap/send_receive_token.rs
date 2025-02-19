use candid::Nat;

use super::swap_calc::SwapCalc;
use super::swap_reply::SwapReply;
use super::swap_reply_helpers::{to_swap_reply, to_swap_reply_failed};

use crate::ic::{
    address::Address,
    transfer::{icp_transfer, icrc1_transfer},
};
use crate::stable_claim::{claim_map, stable_claim::StableClaim};
use crate::stable_request::{reply::Reply, request_map, status::StatusCode};
use crate::stable_token::{stable_token::StableToken, token::Token};
use crate::stable_transfer::{stable_transfer::StableTransfer, transfer_map, tx_id::TxId};
use crate::stable_tx::{stable_tx::StableTx, swap_tx::SwapTx, tx_map};

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

    // send ICP using icp_transfer or ICRC1 using icrc1_transfer
    match match to_address {
        Address::AccountId(to_account_id) => icp_transfer(receive_amount, to_account_id, receive_token, None).await,
        Address::PrincipalId(to_principal_id) => icrc1_transfer(receive_amount, to_principal_id, receive_token, None).await,
    } {
        Ok(tx_id) => {
            // insert_transfer() will use the latest state of DEPOSIT_MAP so no reentrancy issues after icp_transfer() or icrc1_transfer()
            let transfer_id = transfer_map::insert(&StableTransfer {
                transfer_id: 0,
                request_id,
                is_send: false,
                token_id: receive_token_id,
                amount: receive_amount.clone(),
                tx_id: TxId::BlockIndex(tx_id),
                ts,
            });
            transfer_ids.push(transfer_id);
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
            let message = match claim_map::insert(&claim, receive_token) {
                Ok(claim_id) => {
                    claim_ids.push(claim_id);
                    format!("Saved as claim #{}. {}", claim_id, e)
                }
                Err(e) => format!("Failed to save claim. {}", e),
            };
            request_map::update_status(request_id, StatusCode::SendReceiveTokenFailed, Some(&message));
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
