use ic_cdk::query;

use super::claims_reply::ClaimsReply;
use super::claims_reply_helpers::to_claims_reply;

use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_claim::stable_claim::ClaimStatus;
use crate::stable_memory::CLAIM_MAP;
use crate::stable_user::user_map;

/// Return all claimable claims for a user
#[query(guard = "not_in_maintenance_mode")]
fn claims(principal_id: String) -> Result<Vec<ClaimsReply>, String> {
    let user_id = user_map::get_by_principal_id(&principal_id)
        .ok()
        .flatten()
        .ok_or("User not found")?
        .user_id;

    // get all claimable claims for user
    let claims = CLAIM_MAP.with(|m| {
        m.borrow()
            .iter()
            .filter_map(|(_, claim)| {
                if claim.user_id == user_id && claim.status == ClaimStatus::Claimable {
                    Some(to_claims_reply(&claim))
                } else {
                    None
                }
            })
            .collect()
    });

    Ok(claims)
}
