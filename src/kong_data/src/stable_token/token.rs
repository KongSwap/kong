use super::stable_token::StableToken;
use super::stable_token::StableToken::{IC, LP};

pub trait Token {
    fn chain(&self) -> String;
    fn symbol(&self) -> String;
    fn decimals(&self) -> u8;
}

impl Token for StableToken {
    fn chain(&self) -> String {
        match self {
            LP(token) => token.chain(),
            IC(token) => token.chain(),
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
