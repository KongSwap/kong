use candid::Nat;

use super::claim_reply::ClaimReply;

use crate::helpers::nat_helpers::{nat_subtract, nat_zero};
use crate::ic::{
    address::Address::{self, AccountId, PrincipalId},
    get_time::get_time,
    guards::not_in_maintenance_mode,
    logging::error_log,
    transfer::{icp_transfer, icrc1_transfer},
};
use crate::stable_claim::claim_map;
use crate::stable_claim::stable_claim::{ClaimStatus, StableClaim};
use crate::stable_kong_settings::kong_settings_map;
use crate::stable_memory::CLAIM_MAP;
use crate::stable_request::{reply::Reply, request::Request, request_map, stable_request::StableRequest, status::StatusCode};
use crate::stable_token::{stable_token::StableToken, token::Token, token_map};
use crate::stable_transfer::{stable_transfer::StableTransfer, transfer_map, tx_id::TxId};
use crate::stable_user::stable_user::CLAIMS_TIMER_USER_ID;
use crate::transfers::transfer_reply_helpers::to_transfer_ids;

/// send out outstanding claims
pub async fn process_claims() {
    if not_in_maintenance_mode().is_err() {
        return;
    }

    if claim_map::get_num_unclaimed_claims() == 0 {
        return;
    }

    let ts = get_time();

    // get all unclaimed claims
    let claims: Vec<StableClaim> = CLAIM_MAP.with(|m| {
        m.borrow()
            .iter()
            .rev()
            .filter_map(|(_, v)| if v.status == ClaimStatus::Unclaimed { Some(v) } else { None })
            .collect()
    });

    let mut consecutive_errors = 0_u8;
    for claim in &claims {
        if let Some(to_address) = &claim.to_address {
            if claim.attempt_request_id.len() > 50 {
                // if claim has more than 50 attempts, update status to too_many_attempts and investigate manually
                claim_map::update_too_many_attempts_status(claim.claim_id);
                _ = claim_map::archive_to_kong_data(claim.claim_id);
                continue;
            } else if claim.attempt_request_id.len() > 20 {
                if let Some(last_attempt_request_id) = claim.attempt_request_id.last() {
                    if let Some(request) = request_map::get_by_request_id(*last_attempt_request_id) {
                        if request.ts + 3_600_000_000_000 > ts {
                            // if last attempt was less than 1 hour ago, skip this claim
                            continue;
                        }
                    }
                }
            }

            let token = match token_map::get_by_token_id(claim.token_id) {
                Some(token) => token,
                None => continue, // continue to next claim if token not found
            };

            // create new request with CLAIMS_TIMER_USER_ID as user_id
            let request_id = request_map::insert(&StableRequest::new(CLAIMS_TIMER_USER_ID, &Request::Claim(claim.claim_id), ts));
            let claim_id = claim.claim_id;
            match process_claim(request_id, claim_id, &token, &claim.amount, to_address, ts).await {
                Ok(_) => {
                    request_map::update_status(request_id, StatusCode::Success, None);
                    consecutive_errors = 0;
                }
                Err(_) => {
                    request_map::update_status(request_id, StatusCode::Failed, None);
                    consecutive_errors += 1;
                }
            }
            let _ = archive_to_kong_data(request_id);

            if consecutive_errors > 4 {
                error_log("Too many consecutive errors, stopping claims processing.");
                break;
            }
        };
    }
}

async fn process_claim(
    request_id: u64,
    claim_id: u64,
    token: &StableToken,
    amount: &Nat,
    to_address: &Address,
    ts: u64,
) -> Result<ClaimReply, String> {
    let chain = token.chain();
    let symbol = token.symbol();

    let mut transfer_ids = Vec::new();

    request_map::update_status(request_id, StatusCode::Start, None);

    let reply = match send_claim(request_id, claim_id, token, amount, to_address, &mut transfer_ids, ts).await {
        Ok(_) => ClaimReply {
            claim_id,
            status: "Success".to_string(),
            chain: chain.to_string(),
            symbol: symbol.to_string(),
            amount: amount.clone(),
            fee: token.fee(),
            to_address: to_address.to_string(),
            transfer_ids: to_transfer_ids(&transfer_ids),
            ts,
        },
        Err(e) => {
            let reply = ClaimReply {
                claim_id,
                status: "Failed".to_string(),
                chain: chain.to_string(),
                symbol: symbol.to_string(),
                amount: amount.clone(),
                fee: token.fee(),
                to_address: to_address.to_string(),
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
    claim_id: u64,
    token: &StableToken,
    amount: &Nat,
    to_address: &Address,
    transfer_ids: &mut Vec<u64>,
    ts: u64,
) -> Result<(), String> {
    // set the claim status to claiming to prevent reentrancy before sending the claim
    claim_map::update_claiming_status(claim_id);

    request_map::update_status(request_id, StatusCode::ClaimToken, None);

    let amount_with_gas = nat_subtract(amount, &token.fee()).unwrap_or(nat_zero());
    match match to_address {
        AccountId(to_account_id) => icp_transfer(&amount_with_gas, to_account_id, token, None).await,
        PrincipalId(to_principal_id) => icrc1_transfer(&amount_with_gas, to_principal_id, token, None).await,
    } {
        Ok(tx_id) => {
            let transfer_id = transfer_map::insert(&StableTransfer {
                transfer_id: 0,
                request_id,
                is_send: false,
                amount: amount_with_gas,
                token_id: token.token_id(),
                tx_id: TxId::BlockIndex(tx_id),
                ts,
            });
            transfer_ids.push(transfer_id);

            // claim successful. update claim status
            claim_map::update_claimed_status(claim_id, request_id, transfer_id);

            request_map::update_status(request_id, StatusCode::ClaimTokenSuccess, None);

            Ok(())
        }
        Err(e) => {
            // revert claim status to unclaimed
            claim_map::update_unclaimed_status(claim_id, request_id);

            request_map::update_status(request_id, StatusCode::ClaimTokenFailed, Some(&e));

            Err(format!("Failed to send claim_id #{}. {}", claim_id, e))
        }
    }
}

pub fn archive_to_kong_data(request_id: u64) -> Result<(), String> {
    if !kong_settings_map::get().archive_to_kong_data {
        return Ok(());
    }

    if let Some(requst) = request_map::get_by_request_id(request_id) {
        if let Reply::Claim(ref reply) = requst.reply {
            // archive request
            request_map::archive_to_kong_data(&requst)?;
            // archive claim
            claim_map::archive_to_kong_data(reply.claim_id)?;
            // archive transfers
            reply
                .transfer_ids
                .iter()
                .try_for_each(|transfer_id_reply| transfer_map::archive_to_kong_data(transfer_id_reply.transfer_id))?;
        } else {
            return Err("Invalid reply type".to_string());
        }
    } else {
        return Err(format!("Failed to archive. request_id #{} not found", request_id));
    }

    Ok(())
}
