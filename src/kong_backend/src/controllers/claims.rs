use ic_cdk::{query, update};
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_claim::claim_map;
use crate::stable_claim::stable_claim::{ClaimStatus, StableClaim, StableClaimId};
use crate::stable_memory::CLAIM_MAP;
use crate::stable_token::token_map;

const MAX_CLAIMS: usize = 1_000;

/// serialize CLAIM_MAP for backup
#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_claims(claim_id: Option<u64>, num_claims: Option<u16>) -> Result<String, String> {
    CLAIM_MAP.with(|m| {
        let map = m.borrow();
        let claims: BTreeMap<_, _> = match claim_id {
            Some(claim_id) => {
                let start_id = StableClaimId(claim_id);
                let num_claims = num_claims.map_or(1, |n| n as usize);
                map.range(start_id..).take(num_claims).collect()
            }
            None => {
                let num_claims = num_claims.map_or(MAX_CLAIMS, |n| n as usize);
                map.iter().take(num_claims).collect()
            }
        };
        serde_json::to_string(&claims).map_err(|e| format!("Failed to serialize claims: {}", e))
    })
}

/// deserialize CLAIM_MAP and update stable memory
#[update(hidden = true, guard = "caller_is_kingkong")]
fn update_claims(stable_claims: String) -> Result<String, String> {
    let claims: BTreeMap<StableClaimId, StableClaim> = match serde_json::from_str(&stable_claims) {
        Ok(tokens) => tokens,
        Err(e) => return Err(format!("Invalid claims: {}", e)),
    };

    for (_, v) in claims {
        let token = token_map::get_by_token_id(v.token_id).ok_or("Token not found")?;
        claim_map::insert(&v, &token)?;
    }

    Ok("Claims updated".to_string())
}

// "unclaimed"
// "claiming"
// "claimed"
// "too_many_attempts"
#[update(hidden = true, guard = "caller_is_kingkong")]
fn change_claim_status(claim_id: u64, status: String) -> Result<String, String> {
    CLAIM_MAP.with(|m| {
        let status = match status.as_str() {
            "unclaimed" => ClaimStatus::Unclaimed,
            "claiming" => ClaimStatus::Claiming,
            "claimed" => ClaimStatus::Claimed,
            "too_many_attempts" => ClaimStatus::TooManyAttempts,
            _ => return Err("Invalid status".to_string()),
        };
        let mut map = m.borrow_mut();
        let mut claim = map.get(&StableClaimId(claim_id)).ok_or("Claim not found")?;
        claim.status = status;
        map.insert(StableClaimId(claim_id), claim);
        Ok("Claim status changed".to_string())
    })
}
