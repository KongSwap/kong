#![allow(dead_code)]

use candid::Nat;

use super::tokens_reply::TokensReply;
use super::tokens_reply::TokensReply::{IC, LP};

use crate::kong_backend::canister::constants::{IC_CHAIN, LP_CHAIN};
use crate::kong_backend::helpers::nat_helpers::nat_zero;

pub trait Token {
    fn chain(&self) -> &str;
    fn symbol(&self) -> &str;
    fn symbol_with_chain(&self) -> String;
    fn address(&self) -> String;
    fn decimals(&self) -> u8;
    fn fee(&self) -> Nat;
}

impl Token for TokensReply {
    fn chain(&self) -> &str {
        match self {
            LP(_) => LP_CHAIN,
            IC(_) => IC_CHAIN,
        }
    }

    fn symbol(&self) -> &str {
        match self {
            LP(token) => &token.symbol,
            IC(token) => &token.symbol,
        }
    }

    fn symbol_with_chain(&self) -> String {
        format!("{}.{}", self.chain(), self.symbol())
    }

    fn address(&self) -> String {
        match self {
            LP(token) => token.address.to_string(),
            IC(token) => token.canister_id.to_string(),
        }
    }

    fn decimals(&self) -> u8 {
        match self {
            LP(token) => token.decimals,
            IC(token) => token.decimals,
        }
    }

    fn fee(&self) -> Nat {
        match self {
            LP(_) => nat_zero(),
            IC(token) => token.fee.clone(),
        }
    }
}
