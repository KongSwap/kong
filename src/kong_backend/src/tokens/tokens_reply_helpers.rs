use super::tokens_reply::TokensReply;
use num_traits::ToPrimitive; // Added for .to_u64()

use super::ic_reply::ICReply;
use super::lp_reply::LPReply;
use super::sol_reply::SOLReply;

use crate::stable_lp_token::lp_token_map;
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::stable_token::StableToken::{IC, LP, SOL};
use crate::stable_token::token::Token;

pub fn to_token_reply(token: &StableToken) -> TokensReply {
    let token_id = token.token_id();
    match token {
        LP(lp_token) => TokensReply::LP(LPReply {
            token_id,
            chain: token.chain(),
            name: token.name(),
            symbol: token.symbol(),
            address: token.address(),
            pool_id_of: match lp_token.pool_of() {
                Some(pool) => pool.pool_id,
                None => 0,
            },
            decimals: token.decimals(),
            fee: token.fee(),
            total_supply: lp_token_map::get_total_supply(token_id),
            is_removed: token.is_removed(),
        }),
        IC(ic_token) => TokensReply::IC(ICReply {
            token_id,
            chain: token.chain(),
            name: token.name(),
            symbol: token.symbol(),
            canister_id: token.address(),
            decimals: token.decimals(),
            fee: token.fee(),
            icrc1: ic_token.icrc1,
            icrc2: ic_token.icrc2,
            icrc3: ic_token.icrc3,
            is_removed: token.is_removed(),
        }),
        SOL(sol_token) => TokensReply::SOL(SOLReply {
            id: token_id.to_string(),
            name: token.name(),
            symbol: token.symbol(),
            decimals: token.decimals(),
            fee: sol_token.fee.0.to_u64().unwrap_or(0), // Convert Nat to u64
            min_amount: 0u64, // Default value as min_amount is not on SOLToken
            address: token.address(),
        }),
    }
}
