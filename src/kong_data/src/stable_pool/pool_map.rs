use wildmatch::WildMatch;

use crate::stable_memory::POOL_MAP;
use crate::stable_pool::stable_pool::{StablePool, StablePoolId};

pub fn get_by_pool_id(pool_id: u32) -> Option<StablePool> {
    POOL_MAP.with(|m| m.borrow().get(&StablePoolId(pool_id)))
}

pub fn get_by_token_wildcard(token: &str) -> Vec<StablePool> {
    let search_token = WildMatch::new(&format!("*{}*", token));
    POOL_MAP.with(|m| {
        m.borrow()
            .iter()
            .filter_map(|(_, v)| {
                if search_token.matches(v.symbol().as_str())
                    || search_token.matches(v.address().as_str())
                    || search_token.matches(v.symbol_with_chain().as_str())
                    || search_token.matches(v.address_with_chain().as_str())
                {
                    return Some(v);
                }
                None
            })
            .collect()
    })
}

/// Get pool by LP token's id.
pub fn get_by_lp_token_id(lp_token_id: u32) -> Option<StablePool> {
    POOL_MAP.with(|m| {
        m.borrow()
            .iter()
            .find_map(|(_, v)| if v.lp_token_id == lp_token_id { Some(v) } else { None })
    })
}

/// get all pools
pub fn get() -> Vec<StablePool> {
    POOL_MAP.with(|m| {
        m.borrow()
            .iter()
            .filter_map(|(_, v)| if !v.is_removed { Some(v) } else { None })
            .collect()
    })
}
