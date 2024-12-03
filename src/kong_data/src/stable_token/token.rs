use super::stable_token::StableToken;
use super::stable_token::StableToken::{IC, LP};

pub trait Token {
    fn token_id(&self) -> u32;
    fn chain(&self) -> String;
    fn address(&self) -> String;
    fn symbol(&self) -> String;
    fn decimals(&self) -> u8;
}

impl Token for StableToken {
    fn token_id(&self) -> u32 {
        match self {
            LP(token) => token.token_id,
            IC(token) => token.token_id,
        }
    }

    fn chain(&self) -> String {
        match self {
            LP(token) => token.chain(),
            IC(token) => token.chain(),
        }
    }

    fn address(&self) -> String {
        match self {
            // for LP tokens, use address as it's used as the unique identifier
            LP(token) => token.address.to_string(),
            IC(token) => token.canister_id.to_string(),
        }
    }

    fn symbol(&self) -> String {
        match self {
            LP(token) => token.symbol.to_string(),
            IC(token) => token.symbol.to_string(),
        }
    }

    fn decimals(&self) -> u8 {
        match self {
            LP(token) => token.decimals,
            IC(token) => token.decimals,
        }
    }
}
