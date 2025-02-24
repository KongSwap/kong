use ic_cdk::update;

use super::archive_to_kong_data::archive_to_kong_data;
use super::claim_reply::ClaimReply;
use super::process_claim::process_claim;

use crate::ic::address::Address;
use crate::ic::get_time::get_time;
use crate::ic::guards::not_in_maintenance_mode;
use crate::ic::id::{caller_id, caller_principal_id};
use crate::stable_claim::claim_map;
use crate::stable_request::request::Request;
use crate::stable_request::request_map;
use crate::stable_request::stable_request::StableRequest;
use crate::stable_request::status::StatusCode;
use crate::stable_token::token_map;
use crate::stable_user::user_map;

#[update(guard = "not_in_maintenance_mode")]
async fn claim(claim_id: u64) -> Result<ClaimReply, String> {
    // make sure claim belongs to user
    let claim = claim_map::get_by_claim_id(claim_id).ok_or("Claim not found")?;
    let token = token_map::get_by_token_id(claim.token_id).ok_or("Token not found")?;
    let principal_id = caller_principal_id();
    let user_id = user_map::get_by_principal_id(&principal_id)
        .ok()
        .flatten()
        .ok_or("User not found")?
        .user_id;
    if claim.user_id != user_id {
        return Err("Claim not found".to_string());
    }

    let ts = get_time();
    let to_address = match claim.to_address.clone() {
        Some(address) => address,
        None => Address::PrincipalId(caller_id()),
    };

    let request_id = request_map::insert(&StableRequest::new(user_id, &Request::Claim(claim.claim_id), ts));
    let reply = match process_claim(request_id, &claim, &token, &claim.amount, &to_address, ts).await {
        Ok(reply) => {
            request_map::update_status(request_id, StatusCode::Success, None);
            Ok(reply)
        }
        Err(err) => {
            request_map::update_status(request_id, StatusCode::Failed, None);
            Err(err)
        }
    };
    let _ = archive_to_kong_data(request_id);

    reply
}
