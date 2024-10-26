use ic_cdk::query;
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::TOKEN_MAP;
use crate::stable_token::stable_token::StableTokenId;

const MAX_TOKENS: usize = 1_000;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_tokens(token_id: Option<u32>, num_tokens: Option<u16>) -> Result<String, String> {
    match token_id {
        Some(token_id) if num_tokens.is_none() => TOKEN_MAP.with(|m| {
            let key = StableTokenId(token_id);
            serde_json::to_string(&m.borrow().get(&key).map_or_else(
                || Err(format!("Token #{} not found", token_id)),
                |v| Ok(BTreeMap::new().insert(key, v)),
            )?)
            .map_err(|e| format!("Failed to serialize tokens: {}", e))
        }),
        Some(token_id) => TOKEN_MAP.with(|m| {
            let num_tokens = num_tokens.map_or(MAX_TOKENS, |n| n as usize);
            let start_key = StableTokenId(token_id);
            serde_json::to_string(
                &m.borrow()
                    .iter()
                    .collect::<BTreeMap<_, _>>()
                    .iter()
                    .rev()
                    .collect::<BTreeMap<_, _>>()
                    .range(start_key..)
                    .take(num_tokens)
                    .collect::<BTreeMap<_, _>>(),
            )
            .map_err(|e| format!("Failed to serialize tokens: {}", e))
        }),
        None => TOKEN_MAP.with(|m| {
            let num_tokens = num_tokens.map_or(MAX_TOKENS, |n| n as usize);
            serde_json::to_string(
                &m.borrow()
                    .iter()
                    .collect::<BTreeMap<_, _>>()
                    .iter()
                    .rev()
                    .take(num_tokens)
                    .collect::<BTreeMap<_, _>>(),
            )
            .map_err(|e| format!("Failed to serialize tokens: {}", e))
        }),
    }
}
