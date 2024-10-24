use candid::Nat;
use num::BigRational;

use super::pool_map;
use super::stable_pool::StablePool;

use crate::helpers::math_helpers::price_rounded;
use crate::helpers::nat_helpers::{nat_add, nat_is_zero, nat_multiply_f64, nat_to_bigint, nat_to_decimal_precision, nat_zero};
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::token::Token;
use crate::stable_token::token_map;

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
            rolling_24h_volume: nat_zero(),
            rolling_24h_lp_fee: nat_zero(),
            rolling_24h_num_swaps: nat_zero(),
            rolling_24h_apy: 0_f64,
            total_volume: nat_zero(),
            total_lp_fee: nat_zero(),
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

    // returns total balance (balance_0 + balance_1) in token_1
    pub fn get_balance(&self) -> Nat {
        let token_0 = self.token_0();
        let token_1 = self.token_1();
        let balance_0_in_token_1 = nat_to_decimal_precision(&self.balance_0, token_0.decimals(), token_1.decimals());
        let price = self.get_price_as_f64().unwrap_or(0_f64);
        let balance_0 = nat_multiply_f64(&balance_0_in_token_1, price).unwrap_or(nat_zero());
        nat_add(&balance_0, &self.balance_1)
    }

    pub fn set_on_kong(&mut self, on_kong: bool) {
        self.token_0().set_on_kong(on_kong);
        self.token_1().set_on_kong(on_kong);
        self.lp_token().set_on_kong(on_kong);
        self.on_kong = on_kong;
        pool_map::update(self);
    }
}
