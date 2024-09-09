use super::tokens_reply::TokensReply;
use super::tokens_reply::TokensReply::{IC, LP};

pub trait Decimals {
    fn decimals(&self) -> u8;
}

impl Decimals for TokensReply {
    fn decimals(&self) -> u8 {
        match self {
            LP(token) => token.decimals,
            IC(token) => token.decimals,
        }
    }
}
