use super::chain::Chain;
use super::tokens_reply::TokensReply;
use super::tokens_reply::TokensReply::{IC, LP};

pub trait Symbol {
    fn symbol(&self) -> String;
    fn symbol_with_chain(&self) -> String;
}

impl Symbol for TokensReply {
    fn symbol(&self) -> String {
        match self {
            LP(token) => token.symbol.to_string(),
            IC(token) => token.symbol.to_string(),
        }
    }

    fn symbol_with_chain(&self) -> String {
        format!("{}.{}", self.chain(), self.symbol())
    }
}
