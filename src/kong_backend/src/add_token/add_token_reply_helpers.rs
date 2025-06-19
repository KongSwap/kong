use crate::stable_token::stable_token::StableToken;
use crate::stable_token::token::Token;
use crate::tokens::ic_reply::ICReply;
use crate::tokens::solana_reply::SolanaReply;

use super::add_token_reply::AddTokenReply;

pub fn to_add_token_reply(token: &StableToken) -> Result<AddTokenReply, String> {
    match token {
        StableToken::IC(ref ic_token) => Ok(AddTokenReply::IC(ICReply {
            token_id: token.token_id(),
            chain: token.chain(),
            canister_id: token.address(),
            name: token.name(),
            symbol: token.symbol(),
            decimals: token.decimals(),
            fee: token.fee(),
            icrc1: ic_token.icrc1,
            icrc2: ic_token.icrc2,
            icrc3: ic_token.icrc3,
            is_removed: token.is_removed(),
        })),
        StableToken::Solana(ref solana_token) => Ok(AddTokenReply::Solana(SolanaReply {
            token_id: token.token_id(),
            chain: token.chain(),
            name: token.name(),
            symbol: token.symbol(),
            mint_address: solana_token.mint_address.clone(),
            program_id: solana_token.program_id.clone(),
            decimals: token.decimals(),
            fee: token.fee(),
            total_supply: solana_token.total_supply.clone(),
        })),
        _ => Err("Unsupported token type".to_string()),
    }
}
