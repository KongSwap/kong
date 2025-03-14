use wildmatch::WildMatch;

use super::ic_token::ICToken;
use super::lp_token::LPToken;
use super::token::Token;
use super::token_map;

use crate::chains::chains::{IC_CHAIN, LP_CHAIN};
use crate::ic::address_helpers::is_principal_id;
use crate::ic::logging::error_log;
use crate::stable_kong_settings::kong_settings_map;
use crate::stable_memory::TOKEN_MAP;
use crate::stable_token::stable_token::{StableToken, StableTokenId};

/// return Chain.Symbol naming convention for token
/// if symbol is on multiple chains, user must specify Chain.Symbol explicitly and it returns the same
/// if symbol is on a single chain, get the chain and return Chain.Symbol
pub fn symbol_with_chain(symbol: &str) -> Result<String, String> {
    // check if symbol already has chain prefix, if so just return as is
    if symbol.starts_with(&format!("{}.", IC_CHAIN)) || symbol.starts_with(&format!("{}.", LP_CHAIN)) {
        return Ok(symbol.to_string());
    }

    // symbol without chain prefix, check if symbol is on multiple chains
    let tokens = TOKEN_MAP.with(|m| {
        m.borrow()
            .iter()
            .filter_map(|(_, v)| if v.symbol() == symbol { Some(v) } else { None })
            .collect::<Vec<StableToken>>()
    });

    match tokens.len() {
        0 => Err(format!("Symbol {} not found", symbol)),
        1 => Ok(tokens
            .first()
            .ok_or_else(|| format!("Token {} not found", symbol))?
            .symbol_with_chain()),
        _ => Err(format!("Symbol {} is on multiple chains, specify chain or address", symbol)),
    }
}

pub fn address_with_chain(address: &str) -> Result<String, String> {
    // check if address already has chain prefix, if so just return as is
    if address.starts_with(&format!("{}.", IC_CHAIN)) || address.starts_with(&format!("{}.", LP_CHAIN)) {
        return Ok(address.to_string());
    }

    // address without chain prefix, check if address is on multiple chains
    let tokens = TOKEN_MAP.with(|m| {
        m.borrow()
            .iter()
            .filter_map(|(_, v)| if v.address_with_chain() == address { Some(v) } else { None })
            .collect::<Vec<StableToken>>()
    });
    match tokens.len() {
        0 => Err(format!("Address {} not found", address)),
        1 => Ok(tokens
            .first()
            .ok_or_else(|| format!("Address {} not found", address))?
            .address_with_chain()),
        _ => Err("Address {} is on multiple chains, specify chain explicitly".to_string()),
    }
}

/// get the chain prefix from token string
pub fn get_chain(token: &str) -> Option<String> {
    if token.starts_with(IC_CHAIN) {
        Some(IC_CHAIN.to_string())
    } else if token.starts_with(LP_CHAIN) {
        Some(LP_CHAIN.to_string())
    } else {
        None
    }
}

/// get the address from token string
pub fn get_address(token: &str) -> Option<String> {
    let address = match get_chain(token) {
        Some(chain) => {
            // remove chain prefix and return address
            token.replace(&format!("{}.", chain), "")
        }
        None => token.to_string(),
    };
    if is_principal_id(&address) {
        Some(address)
    } else {
        None
    }
}

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

// token can be in the format of Symbol, Chain.Symbol, Address, or Chain.Address
pub fn get_by_token(token: &str) -> Result<StableToken, String> {
    if let Ok(token) = get_by_symbol(token) {
        return Ok(token);
    }
    if let Ok(token) = get_by_address(token) {
        return Ok(token);
    }
    Err(format!("Token {} not found or duplicate symbols/addresses exist", token))
}

// symbol can be in the format of Symbol or Chain.Symbol
// where the Chain prefix will be added if not present
fn get_by_symbol(symbol: &str) -> Result<StableToken, String> {
    // will return error if symbol is not unique
    let symbol_with_chain = symbol_with_chain(symbol)?;
    TOKEN_MAP
        .with(|m| {
            m.borrow().iter().find_map(|(_, v)| {
                if v.symbol_with_chain() == symbol_with_chain {
                    Some(v)
                } else {
                    None
                }
            })
        })
        .ok_or_else(|| format!("Token {} not found", symbol_with_chain))
}

// address can be in the format of Address or Chain.Address
// where the Chain prefix will be added if not present
pub fn get_by_address(address: &str) -> Result<StableToken, String> {
    // will return error if address is not unique
    let address_with_chain = address_with_chain(address)?;
    TOKEN_MAP
        .with(|m| {
            m.borrow().iter().find_map(|(_, v)| {
                if v.address_with_chain() == address_with_chain {
                    Some(v)
                } else {
                    None
                }
            })
        })
        .ok_or_else(|| format!("Token {} not found", address_with_chain))
}

/// return ckUSDT token
pub fn get_ckusdt() -> Result<StableToken, String> {
    token_map::get_by_token_id(kong_settings_map::get().ckusdt_token_id).ok_or("ckUSDT token not found".to_string())
}

/// return ICP token
pub fn get_icp() -> Result<StableToken, String> {
    token_map::get_by_token_id(kong_settings_map::get().icp_token_id).ok_or("ICP token not found".to_string())
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

// token's address is the unique identifier
pub fn exists(address_with_chain: &str) -> bool {
    TOKEN_MAP.with(|m| m.borrow().iter().any(|(_, v)| v.address_with_chain() == address_with_chain))
}

pub fn insert(token: &StableToken) -> Result<u32, String> {
    if exists(token.address_with_chain().as_str()) {
        Err(format!("Token {} already exists", token.symbol_with_chain()))?
    }

    let insert_token = TOKEN_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let token_id = kong_settings_map::inc_token_map_idx();
        let insert_token = match token {
            StableToken::LP(token) => StableToken::LP(LPToken { token_id, ..token.clone() }),
            StableToken::IC(token) => StableToken::IC(ICToken { token_id, ..token.clone() }),
        };
        map.insert(StableTokenId(token_id), insert_token.clone());
        insert_token
    });

    let _ = archive_to_kong_data(&insert_token);
    Ok(insert_token.token_id())
}

pub fn update(token: &StableToken) {
    TOKEN_MAP.with(|m| m.borrow_mut().insert(StableTokenId(token.token_id()), token.clone()));
    let _ = archive_to_kong_data(token);
}

pub fn remove(token_id: u32) -> Result<(), String> {
    let token = get_by_token_id(token_id).ok_or(format!("Token_id #{} not found", token_id))?;

    // set is_removed to true to remove token
    let remove_token = match token {
        StableToken::IC(token) => &StableToken::IC(ICToken { is_removed: true, ..token }),
        StableToken::LP(token) => &StableToken::LP(LPToken { is_removed: true, ..token }),
    };
    update(remove_token);

    Ok(())
}

pub fn unremove(token_id: u32) -> Result<(), String> {
    let token = get_by_token_id(token_id).ok_or(format!("Token_id #{} not found", token_id))?;

    // set is_removed to false to unremove token
    let unremove_token = match token {
        StableToken::IC(token) => &StableToken::IC(ICToken {
            is_removed: false,
            ..token
        }),
        StableToken::LP(token) => &StableToken::LP(LPToken {
            is_removed: false,
            ..token
        }),
    };
    update(unremove_token);

    Ok(())
}

fn archive_to_kong_data(token: &StableToken) -> Result<(), String> {
    if !kong_settings_map::get().archive_to_kong_data {
        return Ok(());
    }

    let token_id = token.token_id();
    let token_json = match serde_json::to_string(token) {
        Ok(token_json) => token_json,
        Err(e) => Err(format!("Failed to serialize token_id #{}. {}", token_id, e))?,
    };

    ic_cdk::spawn(async move {
        let kong_data = kong_settings_map::get().kong_data;
        match ic_cdk::call::<(String,), (Result<String, String>,)>(kong_data, "update_token", (token_json,))
            .await
            .map_err(|e| e.1)
            .unwrap_or_else(|e| (Err(e),))
            .0
        {
            Ok(_) => (),
            Err(e) => error_log(&format!("Failed to archive token_id #{}. {}", token_id, e)),
        };
    });

    Ok(())
}
