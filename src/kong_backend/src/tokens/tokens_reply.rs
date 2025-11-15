use candid::CandidType;
use serde::{Deserialize, Serialize};
use transfer_lib::solana::kong_rpc::solana_reply::SolanaReply;

use crate::stable_lp_token::lp_token_map;
use crate::stable_pool::pool_map;
use kong_lib::stable_token::stable_token::StableToken;
use kong_lib::stable_token::stable_token::StableToken::{Solana, IC, LP};
use kong_lib::stable_token::token::Token;

use super::ic_reply::ICReply;
use super::lp_reply::LPReply;

#[derive(CandidType, Clone, Debug, Serialize, Deserialize)]
pub enum TokensReply {
    LP(LPReply),
    IC(ICReply),
    Solana(SolanaReply),
}

impl From<&StableToken> for TokensReply {
    fn from(token: &StableToken) -> Self {
        let token_id = token.token_id();
        match token {
            LP(lp_token) => TokensReply::LP(LPReply {
                token_id,
                chain: token.chain(),
                name: token.name(),
                symbol: token.symbol(),
                address: token.address(),
                pool_id_of: match pool_map::get_by_lp_token_id(lp_token.token_id) {
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
                is_spl_token: solana_token.is_spl_token,
            }),
        }
    }
}
