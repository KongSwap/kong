use candid::{Nat, Principal};

use super::stable_token::StableToken;
use super::stable_token::StableToken::{IC, LP, Solana};

use crate::helpers::nat_helpers::nat_zero;

pub trait Token {
    fn token_id(&self) -> u32;
    fn name(&self) -> String;
    fn chain(&self) -> String;
    fn address(&self) -> String;
    fn address_with_chain(&self) -> String;
    fn canister_id(&self) -> Option<&Principal>;
    fn symbol(&self) -> String;
    fn symbol_with_chain(&self) -> String;
    fn decimals(&self) -> u8;
    fn fee(&self) -> Nat;
    #[allow(dead_code)]
    fn is_icrc1(&self) -> bool;
    fn is_icrc2(&self) -> bool;
    #[allow(dead_code)]
    fn is_icrc3(&self) -> bool;
    fn is_removed(&self) -> bool;
}

impl Token for StableToken {
    fn token_id(&self) -> u32 {
        match self {
            LP(token) => token.token_id,
            IC(token) => token.token_id,
            Solana(token) => token.token_id,
        }
    }

    fn name(&self) -> String {
        match self {
            LP(token) => token.name().to_string(),
            IC(token) => token.name.to_string(),
            Solana(token) => token.name.to_string(),
        }
    }

    fn chain(&self) -> String {
        match self {
            LP(token) => token.chain(),
            IC(token) => token.chain(),
            Solana(token) => token.chain(),
        }
    }

    fn address(&self) -> String {
        match self {
            // for LP tokens, use address as it's used as the unique identifier
            LP(token) => token.address.to_string(),
            IC(token) => token.canister_id.to_string(),
            Solana(token) => token.mint_address.to_string(),
        }
    }

    fn address_with_chain(&self) -> String {
        format!("{}.{}", self.chain(), self.address())
    }

    fn canister_id(&self) -> Option<&Principal> {
        match self {
            LP(_) => None,
            IC(token) => Some(&token.canister_id),
            Solana(_) => None,
        }
    }

    fn symbol(&self) -> String {
        match self {
            LP(token) => token.symbol.to_string(),
            IC(token) => token.symbol.to_string(),
            Solana(token) => token.symbol.to_string(),
        }
    }

    fn symbol_with_chain(&self) -> String {
        format!("{}.{}", self.chain(), self.symbol())
    }

    fn decimals(&self) -> u8 {
        match self {
            LP(token) => token.decimals,
            IC(token) => token.decimals,
            Solana(token) => token.decimals,
        }
    }

    fn fee(&self) -> Nat {
        match self {
            LP(_) => nat_zero(),
            IC(token) => token.fee.clone(),
            Solana(token) => token.fee.clone(),
        }
    }

    fn is_icrc1(&self) -> bool {
        match self {
            LP(_) => false,
            IC(token) => token.icrc1,
            Solana(_) => false,
        }
    }

    fn is_icrc2(&self) -> bool {
        match self {
            LP(_) => false,
            IC(token) => token.icrc2,
            Solana(_) => false,
        }
    }

    fn is_icrc3(&self) -> bool {
        match self {
            LP(_) => false,
            IC(token) => token.icrc3,
            Solana(_) => false,
        }
    }

    fn is_removed(&self) -> bool {
        match self {
            LP(token) => token.is_removed,
            IC(token) => token.is_removed,
            Solana(_) => false, // Solana tokens don't have is_removed field yet
        }
    }
}

pub fn symbol(token_0: &StableToken, token_1: &StableToken) -> String {
    format!("{}_{}", token_0.symbol(), token_1.symbol())
}

pub fn address(token_0: &StableToken, token_1: &StableToken) -> String {
    format!("{}_{}", token_0.token_id(), token_1.token_id())
}
