use candid::Nat;

use super::stable_lp_token_ledger::StableLPTokenLedger;

use crate::helpers::nat_helpers::{nat_add, nat_zero};
use crate::stable_memory::LP_TOKEN_LEDGER;
use crate::stable_user::user_map;

pub const LP_DECIMALS: u8 = 8; // LP token decimal

/// get lp_token of the caller
pub fn get_by_token_id(token_id: u32) -> Option<StableLPTokenLedger> {
    let user_id = user_map::get_by_caller().ok().flatten()?.user_id;
    get_by_token_id_by_user_id(token_id, user_id)
}

/// get lp_token for specific user
pub fn get_by_token_id_by_user_id(token_id: u32, user_id: u32) -> Option<StableLPTokenLedger> {
    LP_TOKEN_LEDGER.with(|m| {
        m.borrow().iter().find_map(|(_, v)| {
            if v.user_id == user_id && v.token_id == token_id {
                return Some(v);
            }
            None
        })
    })
}

#[allow(dead_code)]
pub fn get() -> Vec<StableLPTokenLedger> {
    let user_id = match user_map::get_by_caller() {
        Ok(Some(caller)) => caller.user_id,
        Ok(None) | Err(_) => return Vec::new(),
    };
    LP_TOKEN_LEDGER.with(|m| {
        m.borrow()
            .iter()
            .filter_map(|(_, v)| if user_id == v.user_id { Some(v) } else { None })
            .collect()
    })
}

pub fn get_total_supply(token_id: u32) -> Nat {
    LP_TOKEN_LEDGER.with(|m| {
        m.borrow()
            .iter()
            .filter_map(|(_, v)| if v.token_id == token_id { Some(v.amount) } else { None })
            .fold(nat_zero(), |acc, x| nat_add(&acc, &x))
    })
}
