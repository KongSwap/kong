use ic_cdk::{query, update};
use std::collections::BTreeMap;

use crate::ic::guards::{caller_is_kingkong, caller_is_kong_backend};
use crate::stable_lp_token::stable_lp_token::{StableLPToken, StableLPTokenId};
use crate::stable_memory::LP_TOKEN_MAP;

const MAX_LP_TOKENS: usize = 1_000;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_lp_tokens(lp_token_id: Option<u64>, num_lp_tokens: Option<u16>) -> Result<String, String> {
    LP_TOKEN_MAP.with(|m| {
        let map = m.borrow();
        let lp_tokens: BTreeMap<_, _> = match lp_token_id {
            Some(lp_token_id) => {
                let num_lp_tokens = num_lp_tokens.map_or(1, |n| n as usize);
                let start_key = StableLPTokenId(lp_token_id);
                map.range(start_key..).take(num_lp_tokens).collect()
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

    Ok("LP token ledger updated".to_string())
}

#[update(hidden = true, guard = "caller_is_kong_backend")]
fn update_lp_token(stable_lp_token_json: String) -> Result<String, String> {
    let lp_token: StableLPToken = match serde_json::from_str(&stable_lp_token_json) {
        Ok(lp_token) => lp_token,
        Err(e) => return Err(format!("Invalid LP token: {}", e)),
    };

    LP_TOKEN_MAP.with(|lp_token_map| {
        let mut map = lp_token_map.borrow_mut();
        map.insert(StableLPTokenId(lp_token.lp_token_id), lp_token);
    });

    Ok("LP token updated".to_string())
}
