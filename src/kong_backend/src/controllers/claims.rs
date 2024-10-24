use ic_cdk::query;
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::CLAIM_MAP;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_claims(claim_id: Option<u64>) -> Result<String, String> {
    match claim_id {
        Some(claim_id) => CLAIM_MAP.with(|m| {
            m.borrow().iter().find(|(k, _)| k.0 == claim_id).map_or_else(
                || Err(format!("Claim #{} not found", claim_id)),
                |(k, v)| serde_json::to_string(&(k, v)).map_err(|e| format!("Failed to serialize claim: {}", e)),
            )
        }),
        None => {
            let claims: BTreeMap<_, _> = CLAIM_MAP.with(|m| m.borrow().iter().collect());
            serde_json::to_string(&claims).map_err(|e| format!("Failed to serialize claims: {}", e))
        }
    }
}
