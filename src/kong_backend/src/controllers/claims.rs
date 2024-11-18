use ic_cdk::{query, update};
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_claim::stable_claim::{ClaimStatus, StableClaim, StableClaimId};
use crate::stable_claim::stable_claim_alt::{StableClaimAlt, StableClaimIdAlt};
use crate::stable_memory::{CLAIM_ALT_MAP, CLAIM_ARCHIVE_MAP, CLAIM_MAP};

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

    CLAIM_MAP.with(|claim_map| {
        let mut map = claim_map.borrow_mut();
        for (k, v) in claims {
            map.insert(k, v);
        }
    });

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

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_archive_claims(claim_id: Option<u64>, num_claims: Option<u16>) -> Result<String, String> {
    CLAIM_ARCHIVE_MAP.with(|m| {
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

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_alt_claims(claim_id: Option<u64>, num_claims: Option<u16>) -> Result<String, String> {
    CLAIM_ALT_MAP.with(|m| {
        let map = m.borrow();
        let claims: BTreeMap<_, _> = match claim_id {
            Some(claim_id) => {
                let start_id = StableClaimIdAlt(claim_id);
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

/// upgrade CLAIM_MAP from CLAIM_ALT_MAP
#[update(hidden = true, guard = "caller_is_kingkong")]
fn upgrade_claims() -> Result<String, String> {
    CLAIM_ALT_MAP.with(|m| {
        let claim_alt_map = m.borrow();
        CLAIM_MAP.with(|m| {
            let mut claim_map = m.borrow_mut();
            claim_map.clear_new();
            for (k, v) in claim_alt_map.iter() {
                let claim_id = StableClaimIdAlt::to_stable_claim_id(&k);
                let claim = StableClaimAlt::to_stable_claim(&v);
                claim_map.insert(claim_id, claim);
            }
        });
    });

    Ok("Claims upgraded".to_string())
}

/// upgrade CLAIM_ALT_MAP from CLAIM_MAP
#[update(hidden = true, guard = "caller_is_kingkong")]
fn upgrade_alt_claims() -> Result<String, String> {
    CLAIM_MAP.with(|m| {
        let claim_map = m.borrow();
        CLAIM_ALT_MAP.with(|m| {
            let mut claim_alt_map = m.borrow_mut();
            claim_alt_map.clear_new();
            for (k, v) in claim_map.iter() {
                let claim_id = StableClaimIdAlt::from_stable_claim_id(&k);
                let claim = StableClaimAlt::from_stable_claim(&v);
                claim_alt_map.insert(claim_id, claim);
            }
        });
    });

    Ok("Alt claims upgraded".to_string())
}
