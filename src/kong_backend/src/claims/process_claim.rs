use candid::Nat;
use transfer_lib::solana::send_info::SendInfo;

use kong_lib::claims::claim_reply::ClaimReply;

use crate::helpers::nat_helpers::{nat_subtract, nat_zero};
use crate::stable_claim::claim_map;
use crate::stable_request::request_map;
use crate::transfers::transfer_reply_helpers::to_transfer_ids;
use kong_lib::ic::address::Address;
use kong_lib::stable_claim::stable_claim::{ClaimStatus, StableClaim};
use kong_lib::stable_request::{reply::Reply, status::StatusCode};
use kong_lib::stable_token::{stable_token::StableToken, token::Token};

pub async fn process_claim(
    request_id: u64,
    claim: &StableClaim,
    token: &StableToken,
    amount: &Nat,
    to_address: &Address,
    ts: u64,
) -> Result<ClaimReply, String> {
    let chain = token.chain();
    let symbol = token.symbol();

    let mut transfer_ids = Vec::new();

    request_map::update_status(request_id, StatusCode::Start, None);

    let reply = match send_claim(request_id, claim, token, amount, to_address, &mut transfer_ids, ts).await {
        Ok(_) => ClaimReply {
            claim_id: claim.claim_id,
            status: "Success".to_string(),
            chain: chain.to_string(),
            symbol: symbol.to_string(),
            canister_id: token.canister_id().map(|id| id.to_text()),
            amount: amount.clone(),
            fee: token.fee(),
            to_address: to_address.to_string(),
            desc: claim.desc.as_ref().map_or_else(String::new, |desc| desc.to_string()),
            transfer_ids: to_transfer_ids(&transfer_ids),
            ts,
        },
        Err(e) => {
            let reply = ClaimReply {
                claim_id: claim.claim_id,
                status: "Failed".to_string(),
                chain: chain.to_string(),
                symbol: symbol.to_string(),
                canister_id: token.canister_id().map(|id| id.to_text()),
                amount: amount.clone(),
                fee: token.fee(),
                to_address: to_address.to_string(),
                desc: claim.desc.as_ref().map_or_else(String::new, |desc| desc.to_string()),
                transfer_ids: to_transfer_ids(&transfer_ids),
                ts,
            };
            request_map::update_reply(request_id, Reply::Claim(reply.clone()));
            return Err(e);
        }
    };

    request_map::update_reply(request_id, Reply::Claim(reply.clone()));

    Ok(reply)
}

async fn send_claim(
    request_id: u64,
    claim: &StableClaim,
    token: &StableToken,
    amount: &Nat,
    to_address: &Address,
    transfer_ids: &mut Vec<u64>,
    ts: u64,
) -> Result<(), String> {
    let claim_status = &claim.status;
    // set the claim status to claiming to prevent reentrancy before sending the claim
    claim_map::update_claiming_status(claim.claim_id);

    request_map::update_status(request_id, StatusCode::ClaimToken, None);

    let amount_with_gas = nat_subtract(amount, &token.fee()).unwrap_or(nat_zero());
    match transfer_lib::send::send(
        token,
        to_address,
        &amount_with_gas,
        SendInfo {
            request_id,
            user_id: claim.user_id,
            ts: Some(ts),
        },
    )
    .await
    {
        Ok(stable_transfer) => {
            transfer_ids.push(stable_transfer.transfer_id);

            // claim successful. update claim status
            claim_map::update_claimed_status(claim.claim_id, request_id, stable_transfer.transfer_id);

            request_map::update_status(request_id, StatusCode::ClaimTokenSuccess, None);

            Ok(())
        }
        Err(e) => {
            // revert claim status to unclaimed or claimable
            match claim_status {
                ClaimStatus::Claimable => claim_map::update_claimable_status(claim.claim_id, request_id),
                _ => claim_map::update_unclaimed_status(claim.claim_id, request_id),
            };

            request_map::update_status(request_id, StatusCode::ClaimTokenFailed, Some(&e));

            Err(format!("Failed to send claim_id #{}. {}", claim.claim_id, e))
        }
    }
}
