use ic_cdk::query;
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::LP_TOKEN_LEDGER;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_lp_token_ledger(user_id: Option<u32>) -> Result<String, String> {
    match user_id {
        Some(user_id) => LP_TOKEN_LEDGER.with(|m| {
            m.borrow().iter().find(|(_, v)| v.user_id == user_id).map_or_else(
                || Err(format!("No record for user #{} found", user_id)),
                |(k, v)| serde_json::to_string(&(k, v)).map_err(|e| format!("Failed to serialize claim: {}", e)),
            )
        }),
        None => {
            let lp_tokens: BTreeMap<_, _> = LP_TOKEN_LEDGER.with(|m| m.borrow().iter().collect());
            serde_json::to_string(&lp_tokens).map_err(|e| format!("Failed to serialize lp_tokens: {}", e))
        }
    }
}
