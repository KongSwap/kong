use super::tokens_reply::TokensReply;
use super::tokens_reply::TokensReply::{IC, LP};
use crate::kong_backend::canister::constants::{IC_CHAIN, LP_CHAIN};

pub trait Chain {
    fn chain(&self) -> String;
}

impl Chain for TokensReply {
    fn chain(&self) -> String {
        match self {
            LP(_) => LP_CHAIN.to_string(),
            IC(_) => IC_CHAIN.to_string(),
        }
    }
}
