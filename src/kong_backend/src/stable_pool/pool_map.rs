use wildmatch::WildMatch;

use crate::ic::logging::error_log;
use crate::stable_kong_settings::kong_settings_map;
use crate::stable_memory::POOL_MAP;
use crate::stable_pool::stable_pool::{StablePool, StablePoolId};
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::token::Token;
use crate::stable_token::token_map;

fn symbol_with_chain(symbol: &str) -> Result<String, String> {
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

fn address_with_chain(address: &str) -> Result<String, String> {
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
                    return Some(v);
                }
                None
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
                    return Some(v);
                }
                None
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
                    return Some(v);
                }
                None
            })
        })
        .ok_or_else(|| format!("Pool {} not found", address_with_chain))
}

pub fn get_by_token_ids(token_id_0: u32, token_id_1: u32) -> Option<StablePool> {
    POOL_MAP.with(|m| {
        m.borrow().iter().find_map(|(_, v)| {
            if v.token_id_0 == token_id_0 && v.token_id_1 == token_id_1 {
                return Some(v);
            }
            None
        })
    })
}

pub fn get_by_tokens(token_0: &str, token_1: &str) -> Result<StablePool, String> {
    let token_0: StableToken = token_map::get_by_token(token_0)?;
    let token_1 = token_map::get_by_token(token_1)?;
    get_by_token_ids(token_0.token_id(), token_1.token_id()).ok_or_else(|| format!("Pool {} not found", symbol(&token_0, &token_1)))
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

/// check if pool exists
pub fn exists(token_0: &StableToken, token_1: &StableToken) -> bool {
    POOL_MAP.with(|m| {
        m.borrow().iter().any(|(_, v)| {
            v.token_id_0 == token_0.token_id() && v.token_id_1 == token_1.token_id()
                || v.token_id_0 == token_1.token_id() && v.token_id_1 == token_0.token_id()
        })
    })
}

pub fn insert(pool: &StablePool) -> Result<u32, String> {
    if exists(&pool.token_0(), &pool.token_1()) {
        Err(format!("Pool {} already exists", pool.symbol()))?
    }

    let insert_pool = POOL_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let pool_id = kong_settings_map::inc_pool_map_idx();
        let insert_pool = StablePool { pool_id, ..pool.clone() };
        map.insert(StablePoolId(pool_id), insert_pool.clone());
        insert_pool
    });

    let _ = archive_to_kong_data(&insert_pool);
    Ok(insert_pool.pool_id)
}

pub fn update(pool: &StablePool) {
    POOL_MAP.with(|m| m.borrow_mut().insert(StablePoolId(pool.pool_id), pool.clone()));
    let _ = archive_to_kong_data(pool);
}

pub fn remove(pool_id: u32) -> Result<(), String> {
    let pool = get_by_pool_id(pool_id).ok_or_else(|| format!("Pool #{} not found", pool_id))?;

    // set is_removed to true to remove pool
    update(&StablePool { is_removed: true, ..pool });

    // remove token_0
    token_map::remove(pool.token_id_0)?;

    // remove LP token
    token_map::remove(pool.lp_token_id)?;

    Ok(())
}

pub fn unremove(pool_id: u32) -> Result<(), String> {
    let pool = get_by_pool_id(pool_id).ok_or_else(|| format!("Pool #{} not found", pool_id))?;

    // set is_removed to false to unremove pool
    update(&StablePool { is_removed: false, ..pool });

    // unremove token_0
    token_map::unremove(pool.token_id_0)?;

    // unremove LP token
    token_map::unremove(pool.lp_token_id)?;

    Ok(())
}

fn archive_to_kong_data(pool: &StablePool) -> Result<(), String> {
    let pool_id = pool.pool_id;
    let pool_json = match serde_json::to_string(pool) {
        Ok(pool_json) => pool_json,
        Err(e) => return Err(format!("Failed to serialize pool_id #{}. {}", pool_id, e)),
    };

    ic_cdk::spawn(async move {
        let kong_data = kong_settings_map::get().kong_data;
        match ic_cdk::call::<(String,), (Result<String, String>,)>(kong_data, "update_pool", (pool_json,))
            .await
            .map_err(|e| e.1)
            .unwrap_or_else(|e| (Err(e),))
            .0
        {
            Ok(_) => (),
            Err(e) => error_log(&format!("Failed to archive pool_id #{}. {}", pool_id, e)),
        }
    });

    Ok(())
}
