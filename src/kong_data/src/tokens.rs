use ic_cdk::{query, update};
use kong_lib::stable_token::stable_token::{StableToken, StableTokenId};
use std::collections::BTreeMap;

use super::guards::caller_is_kingkong;
use super::stable_memory::TOKEN_MAP;

const MAX_TOKENS: usize = 1_000;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_tokens(token_id: Option<u32>, num_tokens: Option<u16>) -> Result<String, String> {
    TOKEN_MAP.with(|m| {
        let map = m.borrow();
        let tokens: BTreeMap<_, _> = match token_id {
            Some(token_id) => {
                let num_tokens = num_tokens.map_or(1, |n| n as usize);
                let start_key = StableTokenId(token_id);
                map.range(start_key..).take(num_tokens).collect()
            }
            None => {
                let num_tokens = num_tokens.map_or(MAX_TOKENS, |n| n as usize);
                map.iter().take(num_tokens).collect()
            }
        };

        serde_json::to_string(&tokens).map_err(|e| format!("Failed to serialize tokens: {}", e))
    })
}

#[update(hidden = true, guard = "caller_is_kingkong")]
fn archive_tokens(stable_tokens: String) -> Result<String, String> {
    let tokens: BTreeMap<StableTokenId, StableToken> = match serde_json::from_str(&stable_tokens) {
        Ok(tokens) => tokens,
        Err(e) => return Err(format!("Invalid tokens: {}", e)),
    };

    TOKEN_MAP.with(|user_map| {
        let mut map = user_map.borrow_mut();
        for (k, v) in tokens.into_iter() {
            map.insert(k, v);
        }
    });

    Ok("Tokens archived".to_string())
}
