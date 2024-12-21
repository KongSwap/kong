use candid::{CandidType, Nat};
use ic_stable_structures::{storable::Bound, Storable};
use num::BigRational;
use serde::{Deserialize, Serialize};

use super::pool_map;

use crate::helpers::math_helpers::price_rounded;
use crate::helpers::nat_helpers::{nat_add, nat_is_zero, nat_to_bigint, nat_to_decimal_precision, nat_zero};
use crate::ic::ckusdt::ckusdt_amount;
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
    pub tvl: Nat,
    pub rolling_24h_volume: Nat,
    pub rolling_24h_lp_fee: Nat,
    pub rolling_24h_num_swaps: Nat,
    pub rolling_24h_apy: f64,
}

impl StablePool {
    pub fn new(token_id_0: u32, token_id_1: u32, lp_fee_bps: u8, kong_fee_bps: u8, lp_token_id: u32, on_kong: bool) -> Self {
        Self {
            pool_id: 0,
            token_id_0,
            balance_0: nat_zero(),
            lp_fee_0: nat_zero(),
            kong_fee_0: nat_zero(),
            token_id_1,
            balance_1: nat_zero(),
            lp_fee_1: nat_zero(),
            kong_fee_1: nat_zero(),
            lp_fee_bps,
            kong_fee_bps,
            lp_token_id,
            on_kong,
            tvl: nat_zero(),
            rolling_24h_volume: nat_zero(),
            rolling_24h_lp_fee: nat_zero(),
            rolling_24h_num_swaps: nat_zero(),
            rolling_24h_apy: 0_f64,
        }
    }

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

    pub fn get_price(&self) -> Option<BigRational> {
        let reserve_0 = nat_add(&self.balance_0, &self.lp_fee_0);
        let reserve_1 = nat_add(&self.balance_1, &self.lp_fee_1);
        if nat_is_zero(&reserve_0) {
            None?
        }

        let token_0 = self.token_0();
        let token_1 = self.token_1();
        let max_decimals = std::cmp::max(token_0.decimals(), token_1.decimals());
        let reserve_0 = nat_to_bigint(&nat_to_decimal_precision(&reserve_0, token_0.decimals(), max_decimals));
        let reserve_1 = nat_to_bigint(&nat_to_decimal_precision(&reserve_1, token_1.decimals(), max_decimals));

        Some(BigRational::new(reserve_1, reserve_0))
    }

    pub fn get_price_as_f64(&self) -> Option<f64> {
        price_rounded(&self.get_price()?)
    }

    /// sets tvl = balance_0 + balance_1 in ckUSDT
    pub fn update_tvl(&mut self) {
        let token_0 = self.token_0();
        let token_1 = self.token_1();
        // TVL_0 = balance_0 + lp_fee_0 + kong_fee_0
        let tvl_0 = nat_add(&nat_add(&self.balance_0, &self.lp_fee_0), &self.kong_fee_0);
        let tvl_1 = nat_add(&nat_add(&self.balance_1, &self.lp_fee_1), &self.kong_fee_1);
        let tvl_0_ckusdt = ckusdt_amount(&token_0, &tvl_0).unwrap_or(nat_zero());
        let tvl_1_ckusdt = ckusdt_amount(&token_1, &tvl_1).unwrap_or(nat_zero());
        self.tvl = nat_add(&tvl_0_ckusdt, &tvl_1_ckusdt);
        pool_map::update(self);
    }

    pub fn set_on_kong(&mut self, on_kong: bool) {
        self.token_0().set_on_kong(on_kong);
        self.token_1().set_on_kong(on_kong);
        self.lp_token().set_on_kong(on_kong);
        self.on_kong = on_kong;
        pool_map::update(self);
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
