use super::tokens_reply::TokensReply;
use super::tokens_reply::TokensReply::{IC, LP};
use candid::Nat;

pub trait Fee {
    fn fee(&self) -> Nat;
}

impl Fee for TokensReply {
    fn fee(&self) -> Nat {
        match self {
            LP(token) => token.fee.clone(),
            IC(token) => token.fee.clone(),
        }
    }
}
