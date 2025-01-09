use wildmatch::WildMatch;

use super::token::Token;

use crate::stable_memory::TOKEN_MAP;
use crate::stable_token::stable_token::{StableToken, StableTokenId};

pub fn get_by_token_id(token_id: u32) -> Option<StableToken> {
    TOKEN_MAP.with(|m| m.borrow().get(&StableTokenId(token_id)))
}

pub fn get_by_token_wildcard(token: &str) -> Vec<StableToken> {
    let search_token = WildMatch::new(&format!("*{}*", token));
    TOKEN_MAP.with(|m| {
        m.borrow()
            .iter()
            .filter_map(|(_, v)| {
                if search_token.matches(v.symbol_with_chain().as_str()) || search_token.matches(v.address_with_chain().as_str()) {
                    Some(v)
                } else {
                    None
                }
            })
            .collect()
    })
}

/// return all tokens
pub fn get() -> Vec<StableToken> {
    TOKEN_MAP.with(|m| {
        m.borrow()
            .iter()
            .filter_map(|(_, v)| if !v.is_removed() { Some(v) } else { None })
            .collect()
    })
}
