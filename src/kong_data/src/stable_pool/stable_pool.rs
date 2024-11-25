use candid::{CandidType, Nat};
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};

use crate::helpers::nat_helpers::nat_zero;
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::token::Token;
use crate::stable_token::token_map;

#[derive(CandidType, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct StablePoolId(pub u32);

impl Storable for StablePoolId {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct StablePool {
    pub pool_id: u32,
    pub token_id_0: u32,
    pub balance_0: Nat,
    pub lp_fee_0: Nat,
    pub kong_fee_0: Nat, // Kong's share of the LP fee
    pub token_id_1: u32,
    pub balance_1: Nat,
    pub lp_fee_1: Nat,
    pub kong_fee_1: Nat,  // Kong's share of the LP fee
    pub lp_fee_bps: u8,   // LP's fee in basis points
    pub kong_fee_bps: u8, // Kong's fee in basis points
    pub lp_token_id: u32, // token id of the LP token
    pub on_kong: bool,    // whether the pool is on Kong
    pub rolling_24h_volume: Nat,
    pub rolling_24h_lp_fee: Nat,
    pub rolling_24h_num_swaps: Nat,
    pub rolling_24h_apy: f64,
    pub total_volume: Nat, // lifetime volume of the pool in token_1
    pub total_lp_fee: Nat, // lifetime LP fee of the pool in token_1
}

impl StablePool {
    pub fn symbol(&self) -> String {
        format!("{}_{}", self.symbol_0(), self.symbol_1())
    }

    pub fn symbol_with_chain(&self) -> String {
        format!("{}_{}", self.token_0().symbol_with_chain(), self.token_1().symbol_with_chain())
    }

    pub fn address(&self) -> String {
        format!("{}_{}", self.token_0().address(), self.token_1().address())
    }

    pub fn address_with_chain(&self) -> String {
        format!("{}_{}", self.token_0().address_with_chain(), self.token_1().address_with_chain())
    }

    pub fn name(&self) -> String {
        format!("{}_{} Liquidity Pool", self.symbol_0(), self.symbol_1())
    }

    pub fn token_0(&self) -> StableToken {
        token_map::get_by_token_id(self.token_id_0).unwrap()
    }

    pub fn chain_0(&self) -> String {
        self.token_0().chain().to_string()
    }

    pub fn symbol_0(&self) -> String {
        self.token_0().symbol().to_string()
    }

    pub fn token_1(&self) -> StableToken {
        token_map::get_by_token_id(self.token_id_1).unwrap()
    }

    pub fn chain_1(&self) -> String {
        self.token_1().chain().to_string()
    }

    pub fn symbol_1(&self) -> String {
        self.token_1().symbol().to_string()
    }

    pub fn lp_token(&self) -> StableToken {
        token_map::get_by_token_id(self.lp_token_id).unwrap()
    }
}

impl Storable for StablePool {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}
