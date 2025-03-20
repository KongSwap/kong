use ic_cdk::{query, update};
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_claim::claim_map;
use crate::stable_claim::stable_claim::{ClaimStatus, StableClaim, StableClaimId};
use crate::stable_memory::CLAIM_MAP;

const MAX_CLAIMS: usize = 1_000;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn max_claim_idx() -> u64 {
    CLAIM_MAP.with(|m| m.borrow().last_key_value().map_or(0, |(k, _)| k.0))
}

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
        Ok(claims) => claims,
        Err(e) => return Err(format!("Invalid claims: {}", e)),
    };

    CLAIM_MAP.with(|claim_map| {
        let mut map = claim_map.borrow_mut();
        for (k, v) in claims {
            let claim_id = k.0;
            map.insert(k, v);
            let _ = claim_map::archive_to_kong_data(claim_id);
        }
    });

    Ok("Claims updated".to_string())
}

#[update(hidden = true, guard = "caller_is_kingkong")]
fn insert_claims(stable_claims: String) -> Result<String, String> {
    let claims: Vec<StableClaim> = match serde_json::from_str(&stable_claims) {
        Ok(claims) => claims,
        Err(e) => return Err(format!("Invalid claims: {}", e)),
    };

    for claim in claims {
        let claim_id = claim_map::insert(&claim);
        let _ = claim_map::archive_to_kong_data(claim_id);
    }

    Ok("Claims inserted".to_string())
}

#[update(hidden = true, guard = "caller_is_kingkong")]
fn change_claim_status(claim_id: u64, status: String) -> Result<String, String> {
    let status = match status.as_str() {
        "unclaimed" => ClaimStatus::Unclaimed,
        "claiming" => ClaimStatus::Claiming,
        "claimed" => ClaimStatus::Claimed,
        "too_many_attempts" => ClaimStatus::TooManyAttempts,
        "unclaimed_override" => ClaimStatus::UnclaimedOverride,
        "claimable" => ClaimStatus::Claimable,
        _ => return Err("Invalid status".to_string()),
    };

    claim_map::update_status(claim_id, status).ok_or("Claim not found")?;

    let _ = claim_map::archive_to_kong_data(claim_id);

    Ok(format!("Claim #{} status changed", claim_id))
}
