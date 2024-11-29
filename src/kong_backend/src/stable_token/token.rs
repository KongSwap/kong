use candid::{Nat, Principal};

use super::stable_token::StableToken;
use super::stable_token::StableToken::{IC, LP};
use super::token_map;

use crate::helpers::nat_helpers::nat_zero;
use crate::stable_kong_settings::kong_settings_map;
use crate::stable_pool::pool_map;

pub trait Token {
    fn token_id(&self) -> u32;
    fn pool_id(&self) -> Option<u32>;
    fn name(&self) -> String;
    fn chain(&self) -> String;
    fn symbol(&self) -> String;
    fn symbol_with_chain(&self) -> String;
    fn address(&self) -> String;
    fn address_with_chain(&self) -> String;
    fn canister_id(&self) -> Option<&Principal>;
    fn decimals(&self) -> u8;
    fn fee(&self) -> Nat;
    fn is_icrc1(&self) -> bool;
    fn is_icrc2(&self) -> bool;
    fn is_icrc3(&self) -> bool;
    fn on_kong(&self) -> bool;
    fn set_on_kong(&mut self, on_kong: bool);
}

impl Token for StableToken {
    fn token_id(&self) -> u32 {
        match self {
            LP(token) => token.token_id,
            IC(token) => token.token_id,
        }
    }

    // Pool ID of the token
    fn pool_id(&self) -> Option<u32> {
        match self {
            LP(_) => None, // currently LP tokens don't have pool
            IC(_) => {
                if let Ok(pool) = pool_map::get_by_tokens(&self.address_with_chain(), &kong_settings_map::get().ckusdt_address_with_chain) {
                    return Some(pool.pool_id);
                }
                if let Ok(pool) = pool_map::get_by_tokens(&self.address_with_chain(), &kong_settings_map::get().icp_address_with_chain) {
                    return Some(pool.pool_id);
                }
                None
            }
        }
    }

    fn name(&self) -> String {
        match self {
            LP(token) => token.name().to_string(),
            IC(token) => token.name.to_string(),
        }
    }

    fn chain(&self) -> String {
        match self {
            LP(token) => token.chain(),
            IC(token) => token.chain(),
        }
    }

    fn symbol(&self) -> String {
        match self {
            LP(token) => token.symbol.to_string(),
            IC(token) => token.symbol.to_string(),
        }
    }

    fn symbol_with_chain(&self) -> String {
        format!("{}.{}", self.chain(), self.symbol())
    }

    fn address(&self) -> String {
        match self {
            // for LP tokens, use address as it's used as the unique identifier
            LP(token) => token.address.to_string(),
            IC(token) => token.canister_id.to_string(),
        }
    }

    fn address_with_chain(&self) -> String {
        format!("{}.{}", self.chain(), self.address())
    }

    fn canister_id(&self) -> Option<&Principal> {
        match self {
            LP(_) => None,
            IC(token) => Some(&token.canister_id),
        }
    }

    fn decimals(&self) -> u8 {
        match self {
            LP(token) => token.decimals,
            IC(token) => token.decimals,
        }
    }

    fn fee(&self) -> Nat {
        match self {
            LP(_) => nat_zero(),
            IC(token) => token.fee.clone(),
        }
    }

    fn is_icrc1(&self) -> bool {
        match self {
            LP(_) => false,
            IC(token) => token.icrc1,
        }
    }

    fn is_icrc2(&self) -> bool {
        match self {
            LP(_) => false,
            IC(token) => token.icrc2,
        }
    }

    fn is_icrc3(&self) -> bool {
        match self {
            LP(_) => false,
            IC(token) => token.icrc3,
        }
    }

    fn on_kong(&self) -> bool {
        match self {
            LP(token) => token.on_kong,
            IC(token) => token.on_kong,
        }
    }

    fn set_on_kong(&mut self, on_kong: bool) {
        match self {
            LP(token) => token.on_kong = on_kong,
            IC(token) => token.on_kong = on_kong,
        };
        token_map::update(self);
    }
}

pub fn symbol(token_0: &StableToken, token_1: &StableToken) -> String {
    format!("{}_{}", token_0.symbol(), token_1.symbol())
}

pub fn address(token_0: &StableToken, token_1: &StableToken) -> String {
    format!("{}_{}", token_0.token_id(), token_1.token_id())
}
