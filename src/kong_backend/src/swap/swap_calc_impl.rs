use candid::Nat;
use num::rational::{BigRational, Ratio};
use num::BigInt;

use super::swap_calc::SwapCalc;

use crate::helpers::nat_helpers::{nat_add, nat_is_zero, nat_subtract, nat_to_bigint, nat_to_decimal_precision, nat_zero};
use crate::stable_pool::pool_map;
use crate::stable_token::token::Token;
use crate::stable_token::token_map;

impl SwapCalc {
    /// this is the net amount the user will receive after the fees and gas are taken off
    /// this is used for price calculations
    pub fn receive_amount_with_fees_and_gas(&self) -> Nat {
        let total_fees = nat_add(&self.lp_fee, &self.gas_fee);
        nat_subtract(&self.receive_amount, &total_fees).unwrap_or(nat_zero())
    }

    // if the swap is zero-amounts, then it will query the pool and return the mid price
    // this is for swap_price where no amount is specified
    pub fn get_price(&self) -> Option<BigRational> {
        if nat_is_zero(&self.pay_amount) {
            return self.get_mid_price();
        }

        let pay_token = token_map::get_by_token_id(self.pay_token_id)?;
        let receive_token = token_map::get_by_token_id(self.receive_token_id)?;
        let max_decimals = std::cmp::max(pay_token.decimals(), receive_token.decimals());
        let pay_amount_in_max_decimals = nat_to_bigint(&nat_to_decimal_precision(&self.pay_amount, pay_token.decimals(), max_decimals));
        let receive_amount_in_max_decimals = nat_to_bigint(&nat_to_decimal_precision(
            &self.receive_amount_with_fees_and_gas(),
            receive_token.decimals(),
            max_decimals,
        ));

        Some(BigRational::new(receive_amount_in_max_decimals, pay_amount_in_max_decimals))
    }

    pub fn get_mid_price(&self) -> Option<BigRational> {
        let pool = pool_map::get_by_pool_id(self.pool_id)?;
        // check if swap is inverted to the pool and if so return the reciprocal price
        // receive_token != pool.token_1 (ckUSDT) means the swap is inverted to the pool
        let price = pool.get_price()?;
        if self.receive_token_id == pool.token_id_1 {
            Some(price)
        } else if price == Ratio::from_integer(BigInt::from(0)) {
            // prevent reciprocal of 0
            None
        } else {
            Some(price.recip())
        }
    }
}
