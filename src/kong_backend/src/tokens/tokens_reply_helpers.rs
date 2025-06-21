use super::tokens_reply::TokensReply;

use super::ic_reply::ICReply;
use super::lp_reply::LPReply;
use super::solana_reply::SolanaReply;

use crate::stable_lp_token::lp_token_map;
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::stable_token::StableToken::{IC, LP, Solana};
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
        Solana(solana_token) => TokensReply::Solana(SolanaReply {
            token_id,
            chain: token.chain(),
            name: token.name(),
            symbol: token.symbol(),
            mint_address: solana_token.mint_address.clone(),
            program_id: solana_token.program_id.clone(),
            decimals: token.decimals(),
            fee: token.fee(),
            total_supply: solana_token.total_supply.clone(),
            is_spl_token: solana_token.is_spl_token,
        }),
    }
}
