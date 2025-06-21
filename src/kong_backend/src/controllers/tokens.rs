use ic_cdk::{query, update};
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::TOKEN_MAP;
use crate::stable_token::stable_token::{StableToken, StableTokenId};
use crate::stable_token::token_map;

const MAX_TOKENS: usize = 1_000;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn max_token_idx() -> u32 {
    TOKEN_MAP.with(|m| m.borrow().last_key_value().map_or(0, |(k, _)| k.0))
}

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

#[update(hidden = true, guard = "caller_is_kingkong")]
fn suspend_token(symbol: String) -> Result<String, String> {
    let token = token_map::get_by_token(&symbol)?;
    match token {
        StableToken::LP(_) => return Err("Cannot suspend LP tokens".to_string()),
        StableToken::IC(token) => {
            token_map::remove(token.token_id)?;
        }
        StableToken::Solana(token) => {
            token_map::remove(token.token_id)?;
        }
    }

    Ok(format!("Token {} suspended", symbol))
}

#[update(hidden = true, guard = "caller_is_kingkong")]
fn unsuspend_token(symbol: String) -> Result<String, String> {
    let token = token_map::get_by_token(&symbol)?;
    match token {
        StableToken::LP(_) => return Err("Cannot unsuspend LP tokens".to_string()),
        StableToken::IC(token) => {
            token_map::unremove(token.token_id)?;
        }
        StableToken::Solana(token) => {
            token_map::unremove(token.token_id)?;
        }
    }

    Ok(format!("Token {} unsuspended", symbol))
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

/// Fix is_spl_token field for existing Solana tokens
#[update(hidden = true, guard = "caller_is_kingkong")]
fn fix_solana_token_spl_flag() -> Result<String, String> {
    // Get all tokens that need fixing
    let tokens_to_fix: Vec<StableToken> = TOKEN_MAP.with(|m| {
        m.borrow()
            .iter()
            .filter_map(|(_, token)| {
                if let StableToken::Solana(sol_token) = &token {
                    // Check if this is native SOL (should have is_spl_token = false)
                    let should_be_spl = sol_token.mint_address != "11111111111111111111111111111111";
                    
                    if sol_token.is_spl_token != should_be_spl {
                        // Create fixed token
                        let mut fixed_sol_token = sol_token.clone();
                        fixed_sol_token.is_spl_token = should_be_spl;
                        Some(StableToken::Solana(fixed_sol_token))
                    } else {
                        None
                    }
                } else {
                    None
                }
            })
            .collect()
    });
    
    // Update tokens outside of TOKEN_MAP borrow
    let fixed_count = tokens_to_fix.len();
    for token in tokens_to_fix {
        token_map::update(&token);
    }
    
    if fixed_count > 0 {
        Ok(format!("Fixed is_spl_token field for {} Solana tokens", fixed_count))
    } else {
        Ok("No Solana tokens needed fixing".to_string())
    }
}
