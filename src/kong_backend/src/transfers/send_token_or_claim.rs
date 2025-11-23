use candid::Nat;
use kong_lib::helpers::nat_helpers::{nat_subtract, nat_zero};
use kong_lib::ic::address::Address;
use kong_lib::stable_claim::stable_claim::StableClaim;
use kong_lib::stable_token::stable_token::StableToken;
use kong_lib::stable_token::token::Token;
use transfer_lib::solana::send_info::SendInfo;

use crate::stable_claim::claim_map;

pub enum ReturnTokenResult {
    TransferId(u64),
    ClaimId(u64, String),
}

pub async fn send_token_or_claim(
    request_id: u64,
    user_id: u32,
    address: &Address,
    token: &StableToken,
    amount: &Nat,
    ts: u64,
) -> ReturnTokenResult {
    let token_id = token.token_id();
    let fee = token.fee();

    let amount_with_gas = nat_subtract(amount, &fee).unwrap_or(nat_zero());
    match transfer_lib::send::send(
        token,
        address,
        &amount_with_gas,
        SendInfo {
            request_id,
            user_id,
            ts: Some(ts),
        },
    )
    .await
    {
        Ok(stable_transfer) => {
            return ReturnTokenResult::TransferId(stable_transfer.transfer_id);
        }
        Err(e) => {
            let claim = StableClaim::new(user_id, token_id, amount, Some(request_id), Some(address.clone()), ts);
            let claim_id = claim_map::insert(&claim);
            return ReturnTokenResult::ClaimId(claim_id, e);
        }
    }
}
