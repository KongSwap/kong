use candid::Nat;

use crate::helpers::nat_helpers::{nat_add, nat_zero};
use crate::stable_memory::LP_TOKEN_MAP;

pub fn get_total_supply(token_id: u32) -> Nat {
    LP_TOKEN_MAP.with(|m| {
        m.borrow()
            .iter()
            .filter_map(|(_, v)| if v.token_id == token_id { Some(v.amount) } else { None })
            .fold(nat_zero(), |acc, x| nat_add(&acc, &x))
    })
}
