use super::tokens_reply::TokensReply;

use super::ic_reply::ICReply;
use super::lp_reply::LPReply;

use crate::stable_lp_token::lp_token_map;
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::stable_token::StableToken::{IC, LP};
use crate::stable_token::token::Token;

pub fn to_token_reply(token: &StableToken) -> TokensReply {
    let token_id = token.token_id();
    match token {
        LP(lp_token) => TokensReply::LP(LPReply {
            token_id,
            chain: token.chain(),
            name: token.name(),
            symbol: token.symbol(),
            token: token.address_with_chain(),
            address: token.address(),
            pool_id_of: match lp_token.pool_of() {
                Some(pool) => pool.pool_id,
                None => 0,
            },
            decimals: token.decimals(),
            fee: token.fee(),
            total_supply: lp_token_map::get_total_supply(token_id),
            on_kong: token.on_kong(),
            metadata: lp_token.metadata.clone(),
        }),
        IC(ic_token) => TokensReply::IC(ICReply {
            token_id,
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
            metadata: ic_token.metadata.clone(),
        }),
    }
}
