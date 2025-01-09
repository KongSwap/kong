use ic_cdk::{query, update};
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::TOKEN_MAP;
use crate::stable_token::stable_token::{StableToken, StableTokenId};
use crate::stable_token::token_map;

const MAX_TOKENS: usize = 1_000;

/// serializes TOKEN_MAP for backup
#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_tokens(token_id: Option<u32>, num_tokens: Option<u16>) -> Result<String, String> {
    TOKEN_MAP.with(|m| {
        let map = m.borrow();
        let tokens: BTreeMap<_, _> = match token_id {
            Some(token_id) => {
                let start_id = StableTokenId(token_id);
                let num_tokens = num_tokens.map_or(1, |n| n as usize);
                map.range(start_id..).take(num_tokens).collect()
            }
            None => {
                let num_tokens = num_tokens.map_or(MAX_TOKENS, |n| n as usize);
                map.iter().take(num_tokens).collect()
            }
        };
        serde_json::to_string(&tokens).map_err(|e| format!("Failed to serialize tokens: {}", e))
    })
}

/// deserialize TOKEN_MAP and update stable memory
#[update(hidden = true, guard = "caller_is_kingkong")]
fn update_tokens(stable_tokens: String) -> Result<String, String> {
    let tokens: BTreeMap<StableTokenId, StableToken> = match serde_json::from_str(&stable_tokens) {
        Ok(tokens) => tokens,
        Err(e) => return Err(format!("Invalid tokens: {}", e)),
    };

    for (_, v) in tokens {
        token_map::update(&v);
    }

    Ok("Tokens updated".to_string())
}
