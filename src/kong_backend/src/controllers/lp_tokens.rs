use ic_cdk::{query, update};
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_lp_token::stable_lp_token::{StableLPToken, StableLPTokenId};
use crate::stable_memory::LP_TOKEN_MAP;

const MAX_LP_TOKENS: usize = 1_000;

/// serialize LP_TOKEN_LEDGER for backup
#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_lp_tokens(lp_token_id: Option<u64>, num_lp_tokens: Option<u16>) -> Result<String, String> {
    LP_TOKEN_MAP.with(|m| {
        let map = m.borrow();
        let lp_tokens: BTreeMap<_, _> = match lp_token_id {
            Some(lp_token_id) => {
                let start_id = StableLPTokenId(lp_token_id);
                let num_lp_tokens = num_lp_tokens.map_or(1, |n| n as usize);
                map.range(start_id..).take(num_lp_tokens).collect()
            }
            None => {
                let num_lp_tokens = num_lp_tokens.map_or(MAX_LP_TOKENS, |n| n as usize);
                map.iter().take(num_lp_tokens).collect()
            }
        };
        serde_json::to_string(&lp_tokens).map_err(|e| format!("Failed to serialize LP tokens: {}", e))
    })
}

/// deserialize LP_TOKEN_LEDGER and update stable memory
#[update(hidden = true, guard = "caller_is_kingkong")]
fn update_lp_tokens(stable_lp_tokens: String) -> Result<String, String> {
    let lp_tokens: BTreeMap<StableLPTokenId, StableLPToken> = match serde_json::from_str(&stable_lp_tokens) {
        Ok(lp_tokens) => lp_tokens,
        Err(e) => return Err(format!("Invalid LP tokens: {}", e)),
    };

    LP_TOKEN_MAP.with(|user_map| {
        let mut map = user_map.borrow_mut();
        for (k, v) in lp_tokens {
            map.insert(k, v);
        }
    });

    Ok("LP tokens updated".to_string())
}
