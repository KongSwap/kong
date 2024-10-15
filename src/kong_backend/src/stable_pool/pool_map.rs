use wildmatch::WildMatch;

use crate::stable_lp_token_ledger::lp_token_ledger;
use crate::stable_pool::stable_pool::{StablePool, StablePoolId};
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::token::Token;
use crate::stable_token::token_map;
use crate::POOL_MAP;

pub fn symbol_with_chain(symbol: &str) -> Result<String, String> {
    let mut symbols = symbol.split('_');
    let symbol_0 = symbols.next().ok_or_else(|| format!("Invalid symbol {}", symbol))?;
    let symbol_1 = symbols.next().ok_or_else(|| format!("Invalid symbol {}", symbol))?;
    if symbols.next().is_some() {
        return Err(format!("Invalid symbol {}", symbol));
    }

    Ok(format!(
        "{}_{}",
        token_map::symbol_with_chain(symbol_0)?,
        token_map::symbol_with_chain(symbol_1)?
    ))
}

pub fn address_with_chain(address: &str) -> Result<String, String> {
    let mut addresses = address.split('_');
    let address_0 = addresses.next().ok_or_else(|| format!("Invalid address {}", address))?;
    let address_1 = addresses.next().ok_or_else(|| format!("Invalid address {}", address))?;
    if addresses.next().is_some() {
        return Err(format!("Invalid address {}", address));
    }

    Ok(format!(
        "{}_{}",
        token_map::address_with_chain(address_0)?,
        token_map::address_with_chain(address_1)?
    ))
}

pub fn symbol(token_0: &StableToken, token_1: &StableToken) -> String {
    format!("{}_{}", token_0.symbol(), token_1.symbol())
}

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
                    Some(v)
                } else {
                    None
                }
            })
            .collect()
    })
}

// token can be in the format of Symbol_Symbol, Chain.Symbol_Chain.Symbol, Address_Address, or Chain.Address_Chain.Address
pub fn get_by_token(token: &str) -> Result<StablePool, String> {
    if let Ok(pool) = get_by_symbol(token) {
        return Ok(pool);
    }
    if let Ok(pool) = get_by_address(token) {
        return Ok(pool);
    }
    Err(format!("Pool {} not found", token))
}

// symbol can be in the format of Symbol_Symbol or Chain.Symbol_Chain.Symbol
// where the Chain prefix will be added if not present
fn get_by_symbol(symbol: &str) -> Result<StablePool, String> {
    let symbol_with_chain = symbol_with_chain(symbol)?;
    POOL_MAP
        .with(|m| {
            m.borrow().iter().find_map(|(_, v)| {
                if v.symbol_with_chain() == symbol_with_chain {
                    Some(v)
                } else {
                    None
                }
            })
        })
        .ok_or_else(|| format!("Pool {} not found", symbol_with_chain))
}

// address can be in the format of Address_Address or Chain.Address_Chain.Address
// where the Chain prefix will be added if not present
fn get_by_address(address: &str) -> Result<StablePool, String> {
    let address_with_chain = address_with_chain(address)?;
    POOL_MAP
        .with(|m| {
            m.borrow().iter().find_map(|(_, v)| {
                if v.address_with_chain() == address_with_chain {
                    Some(v)
                } else {
                    None
                }
            })
        })
        .ok_or_else(|| format!("Pool {} not found", address_with_chain))
}

pub fn get_by_token_ids(token_id_0: u32, token_id_1: u32) -> Option<StablePool> {
    POOL_MAP.with(|m| {
        m.borrow().iter().find_map(|(_, v)| {
            if v.token_id_0 == token_id_0 && v.token_id_1 == token_id_1 {
                Some(v)
            } else {
                None
            }
        })
    })
}

pub fn get_by_tokens(token_0: &str, token_1: &str) -> Result<StablePool, String> {
    let token_0: StableToken = token_map::get_by_token(token_0)?;
    let token_1 = token_map::get_by_token(token_1)?;
    get_by_token_ids(token_0.token_id(), token_1.token_id())
        .ok_or_else(|| format!("Pool {} not found", symbol(&token_0, &token_1)))
}

/// Get pool by LP token's id.
pub fn get_by_lp_token_id(lp_token_id: u32) -> Option<StablePool> {
    POOL_MAP.with(|m| {
        m.borrow()
            .iter()
            .find_map(|(_, v)| if v.lp_token_id == lp_token_id { Some(v) } else { None })
    })
}

/// get all pools listed on Kong
pub fn get_on_kong() -> Vec<StablePool> {
    POOL_MAP.with(|m| {
        m.borrow()
            .iter()
            .filter_map(|(_, v)| if v.on_kong { Some(v) } else { None })
            .collect()
    })
}

/// get all pools
pub fn get() -> Vec<StablePool> {
    POOL_MAP.with(|m| m.borrow().iter().map(|(_, v)| v).collect())
}

// both token's id are the unique identifier for the pool
pub fn exists(token_0: &StableToken, token_1: &StableToken) -> bool {
    POOL_MAP.with(|m| {
        m.borrow()
            .iter()
            .any(|(_, v)| v.token_id_0 == token_0.token_id() && v.token_id_1 == token_1.token_id())
    })
}

pub fn insert(pool: &StablePool) -> Result<u32, String> {
    if exists(&pool.token_0(), &pool.token_1()) {
        Err(format!("Pool {} already exists", pool.symbol()))?
    }
    POOL_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let pool_id = map.iter()
            .map(|(k, _)| k.0)
            .max()
            .unwrap_or(0) // only if empty and first token
            + 1;
        // update pool_id
        let insert_pool = StablePool {
            pool_id,
            ..pool.clone()
        };
        map.insert(StablePoolId(pool_id), insert_pool);
        Ok(pool_id)
    })
}

pub fn update(pool: &StablePool) -> Option<StablePool> {
    POOL_MAP.with(|m| m.borrow_mut().insert(StablePoolId(pool.pool_id), pool.clone()))
}

pub fn remove(pool: &StablePool) -> Result<String, String> {
    // remove pool
    POOL_MAP
        .with(|m| m.borrow_mut().remove(&StablePoolId(pool.pool_id)))
        .ok_or("Unable to remove pool".to_string())?;

    // remove LP token
    token_map::remove(pool.lp_token_id).ok_or("Unable to remove LP token")?;

    // remove LP token ledger
    lp_token_ledger::remove(pool.lp_token_id)?;

    Ok(format!("Pool {} removed", pool.symbol()))
}
