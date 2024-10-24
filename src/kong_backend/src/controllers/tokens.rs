use ic_cdk::query;
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::TOKEN_MAP;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_tokens(token_id: Option<u32>) -> Result<String, String> {
    match token_id {
        Some(token_id) => TOKEN_MAP.with(|m| {
            m.borrow().iter().find(|(k, _)| k.0 == token_id).map_or_else(
                || Err(format!("Token #{} not found", token_id)),
                |(k, v)| serde_json::to_string(&(k, v)).map_err(|e| format!("Failed to serialize token: {}", e)),
            )
        }),
        None => {
            let tokens: BTreeMap<_, _> = TOKEN_MAP.with(|m| m.borrow().iter().collect());
            serde_json::to_string(&tokens).map_err(|e| format!("Failed to serialize tokens: {}", e))
        }
    }
}
