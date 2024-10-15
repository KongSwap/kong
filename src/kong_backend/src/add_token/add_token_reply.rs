use candid::CandidType;
use serde::Serialize;

use crate::stable_pool::pool_map;
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::token::Token;
use crate::tokens::ic_reply::ICReply;

#[derive(CandidType, Serialize)]
pub enum AddTokenReply {
    IC(ICReply),
}

pub fn to_add_token_reply(token: &StableToken) -> Result<AddTokenReply, String> {
    let token_id = token.token_id();
    let pool_symbol = token
        .pool_id()
        .and_then(|pool_id| pool_map::get_by_pool_id(pool_id).map(|pool| pool.symbol()))
        .unwrap_or_else(|| "Pool not found".to_string());
    match token {
        StableToken::IC(ref ic_token) => Ok(AddTokenReply::IC(ICReply {
            token_id,
            pool_symbol,
            chain: token.chain(),
            name: token.name(),
            symbol: token.symbol(),
            token: token.address_with_chain(),
            canister_id: token.address(),
            decimals: token.decimals(),
            fee: token.fee(),
            icrc1: ic_token.icrc1,
            icrc2: ic_token.icrc2,
            icrc3: ic_token.icrc3,
            on_kong: token.on_kong(),
        })),
        _ => Err("Unsupported token type".to_string()),
    }
}
