use candid::Nat;

use super::swap_reply_helpers::to_swap_reply_failed;

use kong_lib::stable_request::reply::Reply;
use crate::stable_request::request_map;
use kong_lib::stable_request::status::StatusCode;
use crate::transfers::send_token_or_claim::send_token_or_claim;
use kong_lib::ic::address::Address;
use kong_lib::stable_token::stable_token::StableToken;

#[allow(clippy::too_many_arguments)]
pub async fn return_pay_token(
    request_id: u64,
    user_id: u32,
    address: Result<Address, String>,
    pay_token: &StableToken,
    pay_amount: &Nat,
    receive_token: Option<&StableToken>,
    transfer_ids: &mut Vec<u64>,
    ts: u64,
) {
    let address = match &address {
        Ok(address) => address,
        Err(e) => {
            request_map::update_status(request_id, StatusCode::ReturnPayTokenFailed, Some(&e));
            return;
        }
    };

    let mut claim_ids = Vec::new();

    request_map::update_status(request_id, StatusCode::ReturnPayToken, None);

    match send_token_or_claim(request_id, user_id, address, pay_token, pay_amount, ts).await {
        crate::transfers::send_token_or_claim::ReturnTokenResult::TransferId(transfer_id) => {
            transfer_ids.push(transfer_id);
            request_map::update_status(request_id, StatusCode::ReturnPayTokenSuccess, None);
        }
        crate::transfers::send_token_or_claim::ReturnTokenResult::ClaimId(claim_id, err) => {
            claim_ids.push(claim_id);
            request_map::update_status(
                request_id,
                StatusCode::ReturnPayTokenFailed,
                Some(&format!("Saved as claim #{}. {}", claim_id, err)),
            );
        }
    };

    let reply = to_swap_reply_failed(request_id, pay_token, pay_amount, receive_token, transfer_ids, &claim_ids, ts);
    request_map::update_reply(request_id, Reply::Swap(reply));
}
