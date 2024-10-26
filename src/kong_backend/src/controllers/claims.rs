use ic_cdk::query;
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_claim::stable_claim::StableClaimId;
use crate::stable_memory::CLAIM_MAP;

const MAX_CLAIMS: usize = 500;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_claims(claim_id: Option<u64>, num_claims: Option<u16>) -> Result<String, String> {
    match claim_id {
        Some(claim_id) if num_claims.is_none() => CLAIM_MAP.with(|m| {
            let key = StableClaimId(claim_id);
            serde_json::to_string(&m.borrow().get(&key).map_or_else(
                || Err(format!("Claim #{} not found", claim_id)),
                |v| Ok(BTreeMap::new().insert(key, v)),
            )?)
            .map_err(|e| format!("Failed to serialize claims: {}", e))
        }),
        Some(claim_id) => CLAIM_MAP.with(|m| {
            let num_claims = num_claims.map_or(MAX_CLAIMS, |n| n as usize);
            let start_key = StableClaimId(claim_id);
            serde_json::to_string(
                &m.borrow()
                    .iter()
                    .collect::<BTreeMap<_, _>>()
                    .iter()
                    .rev()
                    .collect::<BTreeMap<_, _>>()
                    .range(start_key..)
                    .take(num_claims)
                    .collect::<BTreeMap<_, _>>(),
            )
            .map_err(|e| format!("Failed to serialize claims: {}", e))
        }),
        None => CLAIM_MAP.with(|m| {
            let num_claims = num_claims.map_or(MAX_CLAIMS, |n| n as usize);
            serde_json::to_string(
                &m.borrow()
                    .iter()
                    .collect::<BTreeMap<_, _>>()
                    .iter()
                    .rev()
                    .take(num_claims)
                    .collect::<BTreeMap<_, _>>(),
            )
            .map_err(|e| format!("Failed to serialize claims: {}", e))
        }),
    }
}
