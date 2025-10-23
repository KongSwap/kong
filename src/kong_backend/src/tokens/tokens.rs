use ic_cdk::query;

use super::tokens_reply::TokensReply;
use super::tokens_reply_helpers::to_token_reply;

use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_token::token_map;
use crate::stable_token::tokens_args::TokensArgs;


#[query(guard = "not_in_maintenance_mode")]
fn tokens(symbol: Option<String>) -> Result<Vec<TokensReply>, String> {
    let tokens = match symbol.as_deref() {
        Some(symbol) => token_map::get_by_token_wildcard(symbol),
        None => token_map::get(),
    }
    .iter()
    .map(to_token_reply)
    .collect();

    Ok(tokens)
}

#[query(guard = "not_in_maintenance_mode")]
fn tokens_v2(tokens_args: Option<TokensArgs>) -> Result<Vec<TokensReply>, String> {
    let tokens = match tokens_args {
        None => token_map::get_and_map(to_token_reply),
        Some(v) => token_map::get_and_map_tokens_args(v, to_token_reply),
    };

    Ok(tokens)
}
