use crate::stable_memory::TOKEN_MAP;
use crate::stable_token::stable_token::{StableToken, StableTokenId};

pub fn get_by_token_id(token_id: u32) -> Option<StableToken> {
    TOKEN_MAP.with(|m| m.borrow().get(&StableTokenId(token_id)))
}
