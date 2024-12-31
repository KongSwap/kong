use ic_cdk::query;

use super::tokens_reply::TokensReply;
use super::tokens_reply_helpers::to_token_reply;

use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_token::token_map;

/// get tokens
///
/// # Arguments
/// symbol: Option<String> - "all" returns all tokens,
/// otherwise returns the token with the given symbol
/// None returns tokens only listed on Kong
#[query(guard = "not_in_maintenance_mode")]
fn tokens(symbol: Option<String>) -> Result<Vec<TokensReply>, String> {
    let tokens = match symbol.as_deref() {
        Some("all") => token_map::get(),
        Some(symbol) => token_map::get_by_token_wildcard(symbol),
        None => token_map::get_on_kong(),
    }
    .iter()
    .map(to_token_reply)
    .collect();
    Ok(tokens)
}
