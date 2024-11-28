use candid::Nat;

use super::stable_lp_token::{StableLPToken, StableLPTokenId};

use crate::helpers::nat_helpers::{nat_add, nat_subtract, nat_zero};
use crate::ic::get_time::get_time;
use crate::stable_kong_settings::kong_settings_map;
use crate::stable_memory::LP_TOKEN_MAP;
use crate::stable_user::user_map;

pub const LP_DECIMALS: u8 = 8; // LP token decimal

/// get lp_token of the caller
pub fn get_by_token_id(token_id: u32) -> Option<StableLPToken> {
    let user_id = user_map::get_by_caller().ok().flatten()?.user_id;
    get_by_token_id_by_user_id(token_id, user_id)
}

/// get lp_token for specific user
pub fn get_by_token_id_by_user_id(token_id: u32, user_id: u32) -> Option<StableLPToken> {
    LP_TOKEN_MAP.with(|m| {
        m.borrow().iter().find_map(|(_, v)| {
            if v.user_id == user_id && v.token_id == token_id {
                return Some(v);
            }
            None
        })
    })
}

pub fn get_total_supply(token_id: u32) -> Nat {
    LP_TOKEN_MAP.with(|m| {
        m.borrow()
            .iter()
            .filter_map(|(_, v)| if v.token_id == token_id { Some(v.amount) } else { None })
            .fold(nat_zero(), |acc, x| nat_add(&acc, &x))
    })
}

pub fn insert(lp_token: &StableLPToken) -> Result<u64, String> {
    LP_TOKEN_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let lp_token_id = kong_settings_map::inc_lp_token_map_idx();
        let insert_lp_token = StableLPToken {
            lp_token_id,
            ..lp_token.clone()
        };
        map.insert(StableLPTokenId(lp_token_id), insert_lp_token.clone());
        // archive new lp_token
        archive_lp_token(insert_lp_token);
        Ok(lp_token_id)
    })
}

pub fn update(lp_token: &StableLPToken) {
    LP_TOKEN_MAP.with(|m| m.borrow_mut().insert(StableLPTokenId(lp_token.lp_token_id), lp_token.clone()));
    // archive updated lp_token
    archive_lp_token(lp_token.clone());
}

// remove all user entries of LP token
pub fn remove(lp_token_id: u32) -> Result<(), String> {
    LP_TOKEN_MAP.with(|m| {
        let mut lp_tokens = m.borrow_mut();
        let keys_to_remove: Vec<_> = lp_tokens
            .iter()
            .filter_map(|(k, v)| if v.token_id == lp_token_id { Some(k) } else { None })
            .collect();
        for key in keys_to_remove {
            lp_tokens.remove(&key);
        }
    });
    Ok(())
}

/// transfer LP token from caller to another user
///
/// # Arguments
/// token_id - token_id of the LP token
/// to_user_id - user_id of the user to transfer LP token to
/// amount - amount of LP token to transfer
///
/// # Returns
/// StableLPToken - updated LP token of the caller
/// Err - if LP token not found or not enough LP token
pub fn transfer(token_id: u32, to_user_id: u32, amount: &Nat) -> Result<StableLPToken, String> {
    let ts = get_time();

    let from_user = match get_by_token_id(token_id) {
        Some(from_user_lp_token) => {
            if from_user_lp_token.amount < *amount {
                return Err("Not enough LP token".to_string());
            }
            let amount = nat_subtract(&from_user_lp_token.amount, amount).ok_or("Error calculating new user balance")?;
            StableLPToken {
                amount,
                ts,
                ..from_user_lp_token
            }
        }
        None => return Err("Not enough LP token".to_string()),
    };
    update(&from_user);

    if let Some(to_user_lp_token) = get_by_token_id_by_user_id(token_id, to_user_id) {
        // to_user already has some LP token, add to existing balance
        update(&StableLPToken {
            amount: nat_add(&to_user_lp_token.amount, amount),
            ts,
            ..to_user_lp_token
        });
    } else {
        // otherwise, create new LP token for to_user
        insert(&StableLPToken::new(to_user_id, token_id, amount.clone(), ts));
    }

    Ok(from_user)
}

fn archive_lp_token(lp_token: StableLPToken) {
    ic_cdk::spawn(async move {
        match serde_json::to_string(&lp_token) {
            Ok(lp_token_json) => {
                let kong_data = kong_settings_map::get().kong_data;
                match ic_cdk::call::<(String,), (Result<String, String>,)>(kong_data, "update_lp_token", (lp_token_json,))
                    .await
                    .map_err(|e| e.1)
                    .unwrap_or_else(|e| (Err(e),))
                    .0
                {
                    Ok(_) => (),
                    Err(e) => ic_cdk::print(format!("Failed to archive lp_token #{}. {}", lp_token.lp_token_id, e)),
                }
            }
            Err(e) => ic_cdk::print(format!("Failed to serialize lp_token #{}. {}", lp_token.lp_token_id, e)),
        }
    });
}
