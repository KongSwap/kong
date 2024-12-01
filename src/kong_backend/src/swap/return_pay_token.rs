use candid::Nat;

use super::swap_reply_helpers::create_swap_reply_failed;

use crate::helpers::nat_helpers::{nat_subtract, nat_zero};
use crate::ic::{address::Address, id::caller_id, transfer::icrc1_transfer};
use crate::stable_claim::{claim_map, stable_claim::StableClaim};
use crate::stable_request::reply::Reply;
use crate::stable_request::request_map;
use crate::stable_request::status::StatusCode;
use crate::stable_token::{stable_token::StableToken, token::Token};
use crate::stable_transfer::{stable_transfer::StableTransfer, transfer_map, tx_id::TxId};

pub async fn return_pay_token(
    request_id: u64,
    user_id: u32,
    pay_token: &StableToken,
    pay_amount: &Nat,
    receive_token: Option<&StableToken>,
    transfer_ids: &mut Vec<u64>,
    ts: u64,
) {
    let caller_id = caller_id();
    let mut claim_ids = Vec::new();

    request_map::update_status(request_id, StatusCode::ReturnPayToken, None);

    let pay_amount_with_gas = nat_subtract(pay_amount, &pay_token.fee()).unwrap_or(nat_zero());
    match icrc1_transfer(&pay_amount_with_gas, &caller_id, pay_token, None).await {
        Ok(tx_id) => {
            let transfer_id = transfer_map::insert(&StableTransfer {
                transfer_id: 0,
                request_id,
                is_send: false,
                amount: pay_amount_with_gas,
                token_id: pay_token.token_id(),
                tx_id: TxId::BlockIndex(tx_id),
                ts,
            });
            transfer_ids.push(transfer_id);
            request_map::update_status(request_id, StatusCode::ReturnPayTokenSuccess, None);
        }
        Err(e) => {
            let message = match claim_map::insert(&StableClaim::new(
                user_id,
                pay_token.token_id(),
                pay_amount,
                Some(request_id),
                Some(Address::PrincipalId(caller_id)),
                ts,
            )) {
                Ok(claim_id) => {
                    claim_ids.push(claim_id);
                    format!("Saved as claim #{}. {}", claim_id, e)
                }
                Err(e) => format!("Failed to save claim. {}", e),
            };
            request_map::update_status(request_id, StatusCode::ReturnPayTokenFailed, Some(&message));
        }
    };

    let reply = create_swap_reply_failed(request_id, pay_token, pay_amount, receive_token, transfer_ids, &claim_ids, ts);
    request_map::update_reply(request_id, Reply::Swap(reply));
}
