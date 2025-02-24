use super::archive_to_kong_data::archive_to_kong_data;
use super::process_claim::process_claim;

use crate::ic::{get_time::get_time, guards::not_in_maintenance_mode, logging::error_log};
use crate::stable_claim::claim_map;
use crate::stable_claim::stable_claim::ClaimStatus;
use crate::stable_memory::CLAIM_MAP;
use crate::stable_request::{request::Request, request_map, stable_request::StableRequest, status::StatusCode};
use crate::stable_token::token_map;
use crate::stable_user::stable_user::CLAIMS_TIMER_USER_ID;

/// send out outstanding claims where status is Unclaimed or UnclaimedOverride
pub async fn process_claims_timer() {
    if not_in_maintenance_mode().is_err() {
        return;
    }

    let ts = get_time();

    let claim_ids: Vec<u64> = CLAIM_MAP.with(|m| {
        m.borrow()
            .iter()
            .rev()
            .filter_map(|(_, v)| {
                if v.status == ClaimStatus::Unclaimed || v.status == ClaimStatus::UnclaimedOverride {
                    Some(v.claim_id)
                } else {
                    None
                }
            })
            .collect()
    });

    let mut consecutive_errors = 0_u8;
    for claim_id in claim_ids {
        let claim = match claim_map::get_by_claim_id(claim_id) {
            Some(claim) => claim,
            None => continue, // continue to next claim if claim not found
        };
        if claim.status != ClaimStatus::Unclaimed && claim.status != ClaimStatus::UnclaimedOverride {
            continue; // continue to next claim if claim status is not Unclaimed or UnclaimedOverride. This must have changed from the time we got the claim_ids
        }
        let to_address = match &claim.to_address {
            Some(address) => address.clone(),
            None => continue, // continue to next claim if to_address is not found
        };
        let token = match token_map::get_by_token_id(claim.token_id) {
            Some(token) => token,
            None => continue, // continue to next claim if token not found
        };
        if claim.attempt_request_id.len() > 50 && claim.status != ClaimStatus::UnclaimedOverride {
            // if claim has more than 50 attempts, update status to too_many_attempts and investigate manually
            claim_map::update_too_many_attempts_status(claim.claim_id);
            let _ = claim_map::archive_to_kong_data(claim.claim_id);
            continue;
        }
        if claim.attempt_request_id.len() > 20 {
            if let Some(last_attempt_request_id) = claim.attempt_request_id.last() {
                if let Some(request) = request_map::get_by_request_id(*last_attempt_request_id) {
                    if request.ts + 3_600_000_000_000 > ts {
                        // if last attempt was less than 1 hour ago, skip this claim
                        continue;
                    }
                }
            }
        }

        // create new request with CLAIMS_TIMER_USER_ID as user_id
        let request_id = request_map::insert(&StableRequest::new(CLAIMS_TIMER_USER_ID, &Request::Claim(claim.claim_id), ts));
        match process_claim(request_id, &claim, &token, &claim.amount, &to_address, ts).await {
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
            error_log("Too many consecutive errors, stopping claims process");
            break;
        }
    }
}
