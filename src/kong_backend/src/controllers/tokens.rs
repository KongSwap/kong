use ic_cdk::{query, update};
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::{TOKEN_ALT_MAP, TOKEN_ARCHIVE_MAP, TOKEN_MAP};
use crate::stable_token::stable_token::{StableToken, StableTokenId};
use crate::stable_token::stable_token_alt::{StableTokenAlt, StableTokenIdAlt};
use crate::stable_token::token;

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

    TOKEN_MAP.with(|user_map| {
        let mut map = user_map.borrow_mut();
        for (k, v) in tokens {
            map.insert(k, v);
        }
    });

    Ok("Tokens updated".to_string())
}

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_archive_tokens(token_id: Option<u32>, num_tokens: Option<u16>) -> Result<String, String> {
    TOKEN_ARCHIVE_MAP.with(|m| {
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

#[update(hidden = true, guard = "caller_is_kingkong")]
fn upgrade_tokens() -> Result<String, String> {
    TOKEN_ALT_MAP.with(|m| {
        let token_alt_map = m.borrow();
        TOKEN_MAP.with(|m| {
            let mut token_map = m.borrow_mut();
            token_map.clear_new();
            for (k, v) in token_alt_map.iter() {
                let token_id = StableTokenIdAlt::to_stable_token_id(&k);
                let token = StableTokenAlt::to_stable_token(&v);
                token_map.insert(token_id, token);
            }
        });
    });

    Ok("Tokens upgraded".to_string())
}
#[update(hidden = true, guard = "caller_is_kingkong")]
fn upgrade_alt_tokens() -> Result<String, String> {
    TOKEN_MAP.with(|m| {
        let token_map = m.borrow();
        TOKEN_ALT_MAP.with(|m| {
            let mut token_alt_map = m.borrow_mut();
            token_alt_map.clear_new();
            for (k, v) in token_map.iter() {
                let token_id = StableTokenIdAlt::from_stable_token_id(&k);
                let token = StableTokenAlt::from_stable_token(&v);
                token_alt_map.insert(token_id, token);
            }
        });
    });

    Ok("Alt tokens upgraded".to_string())
}
