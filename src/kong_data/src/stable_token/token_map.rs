use wildmatch::WildMatch;

use crate::stable_memory::TOKEN_MAP;
use crate::stable_token::stable_token::{StableToken, StableTokenId};
use crate::stable_token::tokens_args::TokensArgs;

use super::token::Token;

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

pub fn get_and_map_tokens_args<U, F>(tokens_args: TokensArgs, mapper: F) -> Vec<U>
where
    F: Fn(&StableToken) -> U,
{
    let n_take = tokens_args.n_take.unwrap_or(u32::MAX) as usize;
    let n_skip = tokens_args.n_skip.unwrap_or(0) as usize;

    TOKEN_MAP.with(|m| {
        let m = m.borrow();
        let mut it: Box<dyn Iterator<Item = StableToken>> = Box::new(m.iter().map(|(_, v)| v));

        if tokens_args.enabled_only {
            it = Box::new(it.filter_map(|v| if !v.is_removed() { Some(v) } else { None }));
        }

        if let Some(wildcard) = tokens_args.wildcard {
            let wildmatch = WildMatch::new(&format!("*{}*", wildcard));
            it = Box::new(it.filter_map(move |v| {
                if wildmatch.matches(&v.symbol()) || wildmatch.matches(&v.address()) {
                    Some(v)
                } else {
                    None
                }
            }));
        }

        it.skip(n_skip).take(n_take).map(|v| mapper(&v)).collect()
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

// return all mapped tokens
pub fn get_and_map<U, F>(mapper: F) -> Vec<U>
where
    F: Fn(&StableToken) -> U,
{
    TOKEN_MAP.with(|m| {
        m.borrow()
            .iter()
            .filter_map(|(_, v)| if !v.is_removed() { Some(v) } else { None })
            .map(|v| mapper(&v))
            .collect()
    })
}
