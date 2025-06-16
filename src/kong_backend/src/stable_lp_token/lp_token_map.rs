use candid::Nat;

use super::stable_lp_token::{StableLPToken, StableLPTokenId};

use crate::helpers::nat_helpers::{nat_add, nat_zero};
use crate::ic::network::ICNetwork;
use crate::stable_kong_settings::kong_settings_map;
use crate::stable_memory::LP_TOKEN_MAP;
use crate::stable_user::user_map;

/// get lp_token of the caller
pub fn get_by_token_id(token_id: u32) -> Option<StableLPToken> {
    let user_id = user_map::get_by_caller().ok().flatten()?.user_id;
    get_by_token_id_by_user_id(token_id, user_id)
}

/// get lp_token for specific user and token
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

/// get lp_token for specific user
pub fn get_by_user_id(user_id: u32) -> Vec<StableLPToken> {
    LP_TOKEN_MAP.with(|m| {
        m.borrow()
            .iter()
            .filter_map(|(_, v)| if v.user_id == user_id { Some(v) } else { None })
            .collect()
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
    let insert_lp_token = LP_TOKEN_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let lp_token_id = kong_settings_map::inc_lp_token_map_idx();
        let insert_lp_token = StableLPToken {
            lp_token_id,
            ..lp_token.clone()
        };
        map.insert(StableLPTokenId(lp_token_id), insert_lp_token.clone());
        insert_lp_token
    });

    let _ = archive_to_kong_data(&insert_lp_token);
    Ok(insert_lp_token.lp_token_id)
}

pub fn update(lp_token: &StableLPToken) {
    LP_TOKEN_MAP.with(|m| m.borrow_mut().insert(StableLPTokenId(lp_token.lp_token_id), lp_token.clone()));
    _ = archive_to_kong_data(lp_token);
}

pub fn archive_to_kong_data(lp_token: &StableLPToken) -> Result<(), String> {
    if !kong_settings_map::get().archive_to_kong_data {
        return Ok(());
    }

    let lp_token_id = lp_token.lp_token_id;
    let lp_token_json = match serde_json::to_string(lp_token) {
        Ok(lp_token_json) => lp_token_json,
        Err(e) => Err(format!("Failed to serialize lp_token_id #{}. {}", lp_token_id, e))?,
    };

    ic_cdk::spawn(async move {
        let kong_data = kong_settings_map::get().kong_data;
        match ic_cdk::call::<(String,), (Result<String, String>,)>(kong_data, "update_lp_token", (lp_token_json,))
            .await
            .map_err(|e| e.1)
            .unwrap_or_else(|e| (Err(e),))
            .0
        {
            Ok(_) => (),
            Err(e) => ICNetwork::error_log(&format!("Failed to archive lp_token #{}. {}", lp_token_id, e)),
        }
    });

    Ok(())
}
