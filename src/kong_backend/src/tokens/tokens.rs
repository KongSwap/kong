use ic_cdk::query;

use super::tokens_reply::TokensReply;
use super::tokens_reply_helpers::to_token_reply;

use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_token::token_map;

#[query(guard = "not_in_maintenance_mode")]
fn tokens(symbol: Option<String>) -> Result<Vec<TokensReply>, String> {
    if ic_cdk::api::data_certificate().is_none() {
        return Err("swap_amount cannot be called in replicated mode".to_string());
    }

    let tokens = match symbol.as_deref() {
        Some(symbol) => token_map::get_by_token_wildcard(symbol),
        None => token_map::get(),
    }
    .iter()
    .map(to_token_reply)
    .collect();

    Ok(tokens)
}
