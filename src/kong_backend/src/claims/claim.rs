use ic_cdk::update;

use super::archive_to_kong_data::archive_to_kong_data;
use super::claim_reply::ClaimReply;
use super::process_claim::process_claim;

use crate::ic::address::Address;
use crate::ic::guards::not_in_maintenance_mode;
use crate::ic::network::ICNetwork;
use crate::stable_claim::claim_map;
use crate::stable_claim::stable_claim::ClaimStatus;
use crate::stable_request::request::Request;
use crate::stable_request::request_map;
use crate::stable_request::stable_request::StableRequest;
use crate::stable_request::status::StatusCode;
use crate::stable_token::token_map;
use crate::stable_user::user_map;

/// Claim a claimable claim
/// used by user to claim a claimable claim which exists in CLAIM_MAP
#[update(guard = "not_in_maintenance_mode")]
async fn claim(claim_id: u64) -> Result<ClaimReply, String> {
    let claim = claim_map::get_by_claim_id(claim_id).ok_or("Claim not found")?;
    let token = token_map::get_by_token_id(claim.token_id).ok_or("Token not found")?;
    // make sure the caller is the owner of the claim
    let user_id = user_map::get_by_principal_id(&ICNetwork::caller().to_text())
        .ok()
        .flatten()
        .ok_or("User not found")?
        .user_id;
    if claim.user_id != user_id {
        return Err("Claim not found".to_string());
    }
    // make sure claim is in claimable state
    if claim.status != ClaimStatus::Claimable {
        return Err("Claim not found".to_string());
    };

    let ts = ICNetwork::get_time();
    // if to_address is not provided, use the caller's principal id
    let to_address = match &claim.to_address {
        Some(address) => address.clone(),
        None => Address::PrincipalId(ICNetwork::caller_id()),
    };

    // register new request for this claim
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
