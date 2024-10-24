use candid::Nat;
use num::rational::{BigRational, Ratio};
use num::BigInt;
use num::{FromPrimitive, One, Zero};
use num_traits::ToPrimitive;

use super::swap_calc::SwapCalc;

use crate::helpers::math_helpers::round_f64;
use crate::helpers::nat_helpers::{
    nat_add, nat_divide, nat_is_zero, nat_multiply, nat_subtract, nat_to_bigint, nat_to_decimal_precision, nat_zero,
};
use crate::stable_pool::pool_map;
use crate::stable_pool::stable_pool::StablePool;
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

/// Swap amount 0 of a given pool
/// use_lp_fee and use_gas_fee are used to overwrite the default LP and gas fees, if None, then use the pool's default
pub fn swap_amount_0(
    pool: &StablePool,
    amount_0: &Nat,
    user_fee_level: Option<u8>, // user specific fee level, 0 = 100% fee (no discount), 100 = 0% fee (max discount)
    use_lp_fee: Option<u8>,     // overwrite for LP fee in case of 2-legged synthetic swaps
    use_gas_fee: Option<&Nat>,  // overwrite for gas fee in case of synethetic swaps
) -> Result<SwapCalc, String> {
    // Token 0
    let token_0 = pool.token_0();
    let token_id_0 = token_0.token_id();
    // Token 1
    let token_1 = pool.token_1();
    let token_id_1 = token_1.token_id();

    let reserve_0 = nat_add(&pool.balance_0, &pool.lp_fee_0);
    let reserve_1 = nat_add(&pool.balance_1, &pool.lp_fee_1);

    if nat_is_zero(&reserve_0) || nat_is_zero(&reserve_1) {
        return Err("Zero balance in pool".to_string());
    }

    if nat_is_zero(amount_0) {
        // return "mid" swap price if amount_1 is zero
        return Ok(SwapCalc {
            pool_id: pool.pool_id,
            pay_token_id: token_id_0,
            pay_amount: nat_zero(),
            receive_token_id: token_id_1,
            receive_amount: nat_zero(),
            lp_fee: nat_zero(),
            gas_fee: nat_zero(),
        });
    }

    // convert amount_0 and pool balances to the max_decimals precision
    let max_decimals = std::cmp::max(token_0.decimals(), token_1.decimals());
    let reserve_0_in_max_decimals = nat_to_decimal_precision(&reserve_0, token_0.decimals(), max_decimals);
    let reserve_1_in_max_decimals = nat_to_decimal_precision(&reserve_1, token_1.decimals(), max_decimals);
    let amount_0_in_max_decimals = nat_to_decimal_precision(amount_0, token_0.decimals(), max_decimals);

    // amount_1 = (amount_0 * reserve_1) / (reserve_0 + amount_0)
    let numerator_in_max_decimals = nat_multiply(&amount_0_in_max_decimals, &reserve_1_in_max_decimals);
    let denominator_in_max_decimals = nat_add(&reserve_0_in_max_decimals, &amount_0_in_max_decimals);
    let amount_1_in_max_decimals = nat_divide(&numerator_in_max_decimals, &denominator_in_max_decimals).ok_or("Invalid amount_1")?;

    // calculate the LP fees
    // any user fee discount. user.fee_level is 0 = 100% fee (no discount), 100 = 0% fee (max discount)
    // user_lp_fee_pct = 100 - user.fee_level
    let user_lp_fee_pct = nat_subtract(&Nat::from(100_u8), &Nat::from(user_fee_level.unwrap_or(0_u8))).unwrap_or(Nat::from(100_u8));
    // user_lp_fee_bps = (user_lp_fee * user_lp_fee_pct) / 100 - user's fee level in bps with discount
    let user_lp_fee_bps = nat_divide(
        &nat_multiply(&user_lp_fee_pct, &Nat::from(use_lp_fee.unwrap_or(pool.lp_fee_bps))),
        &Nat::from(100_u8),
    )
    .ok_or("Invalid LP fee")?;
    // lp_fee_1 = (amount_1 * user_lp_fee_bps) / 10_000
    let numerator_in_max_decimals = nat_multiply(&amount_1_in_max_decimals, &user_lp_fee_bps);
    let lp_fee_1_in_max_decimals = nat_divide(&numerator_in_max_decimals, &Nat::from(10_000_u128)).ok_or("Invalid LP fee")?;

    // convert amount_1 and lp_fee_1 from max_decimals to token_1 precision
    let amount_1 = nat_to_decimal_precision(&amount_1_in_max_decimals, max_decimals, token_1.decimals());
    let lp_fee = nat_to_decimal_precision(&lp_fee_1_in_max_decimals, max_decimals, token_1.decimals());
    let gas_fee = use_gas_fee.map_or_else(|| token_1.fee(), |fee| fee.clone());

    if amount_1 > reserve_1 {
        return Err(format!("Insufficient {} in pool", token_1.symbol()));
    }

    Ok(SwapCalc {
        pool_id: pool.pool_id,
        pay_token_id: token_id_0,
        pay_amount: amount_0.clone(),
        receive_token_id: token_id_1,
        receive_amount: amount_1,
        lp_fee,
        gas_fee,
    })
}

/// Swap amount 1 of a given pool
/// use_lp_fee and use_gas_fee are used to overwrite the default LP and gas fees, if None, then use the pool's default
pub fn swap_amount_1(
    pool: &StablePool,
    amount_1: &Nat,
    user_fee_level: Option<u8>,
    use_lp_fee: Option<u8>,
    use_gas_fee: Option<&Nat>,
) -> Result<SwapCalc, String> {
    // Token 0
    let token_0 = pool.token_0();
    let token_id_0 = token_0.token_id();
    // Token 1
    let token_1 = pool.token_1();
    let token_id_1 = token_1.token_id();

    let reserve_0 = nat_add(&pool.balance_0, &pool.lp_fee_0);
    let reserve_1 = nat_add(&pool.balance_1, &pool.lp_fee_1);

    if nat_is_zero(&reserve_0) || nat_is_zero(&reserve_1) {
        return Err(format!("Pool {} insufficent balances", pool.symbol()));
    }

    if nat_is_zero(amount_1) {
        // return "mid" swap price if amount_1 is zero
        return Ok(SwapCalc {
            pool_id: pool.pool_id,
            pay_token_id: token_id_1,
            pay_amount: nat_zero(),
            receive_token_id: token_id_0,
            receive_amount: nat_zero(),
            lp_fee: nat_zero(),
            gas_fee: nat_zero(),
        });
    }

    // convert amount_1 and pool balances to the max_decimals precision
    let max_decimals = std::cmp::max(token_0.decimals(), token_1.decimals());
    let reserve_0_in_max_decimals = nat_to_decimal_precision(&reserve_0, token_0.decimals(), max_decimals);
    let reserve_1_in_max_decimals = nat_to_decimal_precision(&reserve_1, token_1.decimals(), max_decimals);
    let amount_1_in_max_decimals = nat_to_decimal_precision(amount_1, token_1.decimals(), max_decimals);

    // amount_0 = (amount_1 * reserve_0) / (reserve_1 + amount_1)
    let numerator_in_max_decimals = nat_multiply(&amount_1_in_max_decimals, &reserve_0_in_max_decimals);
    let denominator_in_max_decimals = nat_add(&reserve_1_in_max_decimals, &amount_1_in_max_decimals);
    let amount_0_in_max_decimals = nat_divide(&numerator_in_max_decimals, &denominator_in_max_decimals).ok_or("Invalid amount_0")?;

    // calculate the LP fees
    // user_lp_fee_pct = 100 - user.fee_level
    let user_lp_fee_pct = nat_subtract(&Nat::from(100_u8), &Nat::from(user_fee_level.unwrap_or(0_u8))).unwrap_or(Nat::from(100_u8));
    let user_lp_fee_bps = nat_divide(
        &nat_multiply(&user_lp_fee_pct, &Nat::from(use_lp_fee.unwrap_or(pool.lp_fee_bps))),
        &Nat::from(100_u8),
    )
    .ok_or("Invalid LP fee")?;
    let numerator_in_max_decimals = nat_multiply(&amount_0_in_max_decimals, &user_lp_fee_bps);
    let lp_fee_0_in_max_decimals = nat_divide(&numerator_in_max_decimals, &Nat::from(10_000_u128)).ok_or("Invalid LP fee")?;

    // convert amount_0 and lp_fee_0 to token_0 precision
    let amount_0 = nat_to_decimal_precision(&amount_0_in_max_decimals, max_decimals, token_0.decimals());
    let lp_fee = nat_to_decimal_precision(&lp_fee_0_in_max_decimals, max_decimals, token_0.decimals());
    let gas_fee = use_gas_fee.map_or_else(|| token_0.fee(), |fee| fee.clone());

    if amount_0 > reserve_0 {
        return Err(format!("Insufficient {} in pool", token_0.symbol()));
    }

    Ok(SwapCalc {
        pool_id: pool.pool_id,
        pay_token_id: token_id_1,
        pay_amount: amount_1.clone(),
        receive_token_id: token_id_0,
        receive_amount: amount_0,
        lp_fee,
        gas_fee,
    })
}

pub fn get_slippage(price_achieved: &BigRational, price_expected: &BigRational) -> Option<f64> {
    if price_achieved > price_expected {
        return Some(0.0); // if price is greater than expected, slippage is 0
    }
    if price_expected.is_zero() {
        None?;
    }

    // slippage = 100 * (price_achieved / price_expected - 1)
    let raw_slippage = (BigRational::from_i32(100)? * (price_achieved / price_expected - BigRational::one()))
        .to_f64()?
        .abs();
    Some(round_f64(raw_slippage, 2)) // 2 decimals
}
