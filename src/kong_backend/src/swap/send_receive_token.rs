use candid::Nat;

use super::swap_calc::SwapCalc;
use super::swap_reply::SwapReply;

use crate::ic::{
    address::Address,
    logging::error_log,
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
                amount: receive_amount.clone(),
                token_id: receive_token.token_id(),
                tx_id: TxId::BlockIndex(tx_id),
                ts,
            });
            transfer_ids.push(transfer_id);
            request_map::update_status(request_id, StatusCode::SendReceiveTokenSuccess, None);
        }
        Err(e) => {
            let claim_id = claim_map::insert(&StableClaim::new(
                user_id,
                receive_token.token_id(),
                receive_amount,
                Some(request_id),
                Some(to_address.clone()),
                ts,
            ));
            claim_ids.push(claim_id);
            let message = format!("{} Saved as claim #{}", e, claim_id);
            error_log(&format!(
                "Swap Req #{} Kong failed to send {} {}: {}",
                request_id,
                receive_amount,
                receive_token.symbol(),
                message
            ));
            request_map::update_status(request_id, StatusCode::SendReceiveTokenFailed, Some(&message));
        }
    }

    let swap_tx = SwapTx::new_success(
        user_id,
        request_id,
        pay_token.token_id(),
        pay_amount,
        receive_token.token_id(),
        receive_amount,
        mid_price,
        price,
        slippage,
        txs,
        transfer_ids,
        &claim_ids,
        ts,
    );
    // insert tx
    let tx_id = tx_map::insert(&StableTx::Swap(swap_tx.clone()));
    let reply = SwapReply::new_with_tx_id(tx_id, &swap_tx);
    request_map::update_reply(request_id, Reply::Swap(reply.clone()));
    reply
}
