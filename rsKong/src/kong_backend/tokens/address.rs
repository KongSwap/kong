use super::tokens_reply::TokensReply;
use super::tokens_reply::TokensReply::{IC, LP};

pub trait Address {
    fn address(&self) -> Option<String>;
}

impl Address for TokensReply {
    fn address(&self) -> Option<String> {
        match self {
            LP(token) => Some(token.address.to_string()),
            IC(token) => Some(token.address.to_string()),
        }
    }
}
