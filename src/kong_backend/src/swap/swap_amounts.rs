use candid::Nat;
use num::rational::BigRational;
use num::{FromPrimitive, One, Zero};
use num_traits::ToPrimitive;

use super::swap_calc::SwapCalc;

use crate::helpers::math_helpers::price_rounded;
use crate::helpers::math_helpers::round_f64;
use crate::helpers::nat_helpers::nat_zero;
use crate::helpers::nat_helpers::{nat_add, nat_divide, nat_is_zero, nat_multiply, nat_subtract, nat_to_decimal_precision};
use crate::stable_pool::pool_map;
use crate::stable_pool::stable_pool::StablePool;
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::token::Token;
use crate::stable_token::token_map;
use crate::stable_user::user_map;

/// Calculate the ckusdt amount for a given pay token and amount
///
/// Returns (receive_amount, mid_price)
pub fn ckusdt_amount(pay_token: &StableToken, pay_amount: &Nat) -> Result<(Nat, f64), String> {
    let ckusdt_token = token_map::get_ckusdt()?;
    let (receive_amount, _, mid_price, _, _) = swap_amounts(pay_token, pay_amount, &ckusdt_token)?;
    Ok((receive_amount, mid_price))
}

pub fn swap_amounts(
    pay_token: &StableToken,
    pay_amount: &Nat,
    receive_token: &StableToken,
) -> Result<(Nat, f64, f64, f64, Vec<SwapCalc>), String> {
    // Pay token
    let pay_token_id = pay_token.token_id();
    // Receive token
    let receive_token_id = receive_token.token_id();

    let user_fee_level = user_map::get_by_caller().ok().flatten().unwrap_or_default().fee_level;
    let mut txs = Vec::new();

    // check if direct pool exists
    if let Some(pool) = pool_map::get_by_token_ids(pay_token_id, receive_token_id) {
        let swap = swap_amount_0(&pool, pay_amount, Some(user_fee_level), None, None)?;
        let receive_amount = swap.receive_amount_with_fees_and_gas();
        let price = swap.get_price().ok_or("Invalid price")?;
        let price_f64 = price_rounded(&price).ok_or("Invalid price")?;
        let mid_price = swap.get_mid_price().ok_or("Invalid mid price")?;
        let mid_price_f64 = price_rounded(&mid_price).ok_or("Invalid mid price")?;
        let slippage_f64 = get_slippage(&price, &mid_price).ok_or("Invalid slippage")?;
        txs.push(swap);
        return Ok((receive_amount, price_f64, mid_price_f64, slippage_f64, txs));
    };

    if let Some(pool) = pool_map::get_by_token_ids(receive_token_id, pay_token_id) {
        let swap = swap_amount_1(&pool, pay_amount, Some(user_fee_level), None, None)?;
        let receive_amount = swap.receive_amount_with_fees_and_gas();
        let price = swap.get_price().ok_or("Invalid price")?;
        let price_f64 = price_rounded(&price).ok_or("Invalid price")?;
        let mid_price = swap.get_mid_price().ok_or("Invalid mid price")?;
        let mid_price_f64 = price_rounded(&mid_price).ok_or("Invalid mid price")?;
        let slippage_f64 = get_slippage(&price, &mid_price).ok_or("Invalid slippage")?;
        txs.push(swap);
        return Ok((receive_amount, price_f64, mid_price_f64, slippage_f64, txs));
    };

    // test for 2-step swap via ckUSDT or ICP
    let ckusdt_token_id = token_map::get_ckusdt()?.token_id();
    let icp_token_id = token_map::get_icp()?.token_id();
    let pool1_ckusdt = pool_map::get_by_token_ids(pay_token_id, ckusdt_token_id);
    let pool2_ckusdt = pool_map::get_by_token_ids(receive_token_id, ckusdt_token_id);
    let pool1_icp = pool_map::get_by_token_ids(pay_token_id, icp_token_id);
    let pool2_icp = pool_map::get_by_token_ids(receive_token_id, icp_token_id);
    if pool1_ckusdt.is_some() && pool2_ckusdt.is_some() || pool1_icp.is_some() && pool2_icp.is_some() {
        let swaps_ckusdt = if pool1_ckusdt.is_some() && pool2_ckusdt.is_some() {
            // 2-step swap
            // split the LP fee between the two swaps. the "+ 1) / 2" will round up the integer
            // 1st swap no gas fees as this is intermediate swap
            // 2nd swap use standard gas fees
            // both pools: token0/ckUSDT and token1/ckUSDT
            let pool1 = match pool1_ckusdt {
                Some(ref pool) => pool,
                None => return Err("Pool not found".to_string()),
            };
            let pool2 = match pool2_ckusdt {
                Some(ref pool) => pool,
                None => return Err("Pool not found".to_string()),
            };
            let swap1_lp_fee = (pool1.lp_fee_bps + 1) / 2;
            // swap token0 to ckUSDT
            let swap1 = swap_amount_0(pool1, pay_amount, Some(user_fee_level), Some(swap1_lp_fee), Some(&nat_zero()))?;
            let swap2_lp_fee = (pool2.lp_fee_bps + 1) / 2;
            // swap ckUSDT to token1 (reverse order of pool)
            let swap2 = swap_amount_1(
                pool2,
                &swap1.receive_amount_with_fees_and_gas(),
                Some(user_fee_level),
                Some(swap2_lp_fee),
                None,
            )?;
            Some((swap1, swap2))
        } else {
            None
        };

        let swaps_icp = if pool1_icp.is_some() && pool2_icp.is_some() {
            // both pools: token0/ICP and token1/ICP
            let pool1 = match pool1_icp {
                Some(ref pool) => pool,
                None => return Err("Pool not found".to_string()),
            };
            let pool2 = match pool2_icp {
                Some(ref pool) => pool,
                None => return Err("Pool not found".to_string()),
            };
            let swap1_lp_fee = (pool1.lp_fee_bps + 1) / 2;
            // swap token0 to ICP
            let swap1 = swap_amount_0(pool1, pay_amount, Some(user_fee_level), Some(swap1_lp_fee), Some(&nat_zero()))?;
            let swap2_lp_fee = (pool2.lp_fee_bps + 1) / 2;
            // swap ICP to token1 (reverse order of pool)
            let swap2 = swap_amount_1(
                pool2,
                &swap1.receive_amount_with_fees_and_gas(),
                Some(user_fee_level),
                Some(swap2_lp_fee),
                None,
            )?;
            Some((swap1, swap2))
        } else {
            None
        };

        // if both ckUSDT and ICP routes are possible, choose the one with the most receive amount
        let (swap1, swap2) = if swaps_ckusdt.is_some() && swaps_icp.is_some() {
            let swaps_ckusdt = swaps_ckusdt.unwrap();
            let swaps_icp = swaps_icp.unwrap();
            if swaps_ckusdt.1.receive_amount >= swaps_icp.1.receive_amount {
                (swaps_ckusdt.0, swaps_ckusdt.1)
            } else {
                (swaps_icp.0, swaps_icp.1)
            }
        } else if swaps_ckusdt.is_some() {
            let swaps_ckusdt = swaps_ckusdt.unwrap();
            (swaps_ckusdt.0, swaps_ckusdt.1)
        } else if swaps_icp.is_some() {
            let swaps_icp = swaps_icp.unwrap();
            (swaps_icp.0, swaps_icp.1)
        } else {
            // should never happen
            return Err("Pool not found".to_string());
        };
        let receive_amount = swap2.receive_amount_with_fees_and_gas();
        let swap1_price = swap1.get_price().ok_or("Invalid swap1 price")?;
        let swap2_price = swap2.get_price().ok_or("Invalid swap2 price")?;
        let price = swap1_price * swap2_price;
        let price_f64 = price_rounded(&price).ok_or("Invalid price")?;
        let swap1_mid_price = swap1.get_mid_price().ok_or("Invalid swap1 mid price")?;
        let swap2_mid_price = swap2.get_mid_price().ok_or("Invalid swap2 mid price")?;
        let mid_price = swap1_mid_price * swap2_mid_price;
        let mid_price_f64 = price_rounded(&mid_price).ok_or("Invalid mid price")?;
        let slippage_f64 = get_slippage(&price, &mid_price).ok_or("Invalid slippage")?;
        txs.push(swap1);
        txs.push(swap2);
        return Ok((receive_amount, price_f64, mid_price_f64, slippage_f64, txs));
    }

    // special case where pay token is ckUSDT and token0/ckUSDT pool does not exist so need to use token0/ICP pool
    let pool1_icp_ckusdt = pool_map::get_by_token_ids(icp_token_id, ckusdt_token_id);
    if pay_token_id == ckusdt_token_id && pool1_icp_ckusdt.is_some() && pool2_icp.is_some() {
        let pool1 = match pool1_icp_ckusdt {
            Some(ref pool) => pool,
            None => return Err("Pool not found".to_string()),
        };
        let pool2 = match pool2_icp {
            Some(ref pool) => pool,
            None => return Err("Pool not found".to_string()),
        };
        let swap1_lp_fee = (pool1.lp_fee_bps + 1) / 2;
        // swap ckUSDT to ICP (reverse order of pool)
        let swap1 = swap_amount_1(pool1, pay_amount, Some(user_fee_level), Some(swap1_lp_fee), Some(&nat_zero()))?;
        let swap2_lp_fee = (pool2.lp_fee_bps + 1) / 2;
        // swap ICP to token1 (reverse order of pool)
        let swap2 = swap_amount_1(
            pool2,
            &swap1.receive_amount_with_fees_and_gas(),
            Some(user_fee_level),
            Some(swap2_lp_fee),
            None,
        )?;
        let receive_amount = swap2.receive_amount_with_fees_and_gas();
        let swap1_price = swap1.get_price().ok_or("Invalid swap1 price")?;
        let swap2_price = swap2.get_price().ok_or("Invalid swap2 price")?;
        let price = swap1_price * swap2_price;
        let price_f64 = price_rounded(&price).ok_or("Invalid price")?;
        let swap1_mid_price = swap1.get_mid_price().ok_or("Invalid swap1 mid price")?;
        let swap2_mid_price = swap2.get_mid_price().ok_or("Invalid swap2 mid price")?;
        let mid_price = swap1_mid_price * swap2_mid_price;
        let mid_price_f64 = price_rounded(&mid_price).ok_or("Invalid mid price")?;
        let slippage_f64 = get_slippage(&price, &mid_price).ok_or("Invalid slippage")?;
        txs.push(swap1);
        txs.push(swap2);
        return Ok((receive_amount, price_f64, mid_price_f64, slippage_f64, txs));
    };

    // special case where receieve token is ckUSDT and token0/ckUSDT pool does not exist so need to use token0/ICP pool
    let pool2_icp_ckusdt = pool_map::get_by_token_ids(icp_token_id, ckusdt_token_id);
    if receive_token_id == ckusdt_token_id && pool1_icp.is_some() && pool2_icp_ckusdt.is_some() {
        let pool1 = match pool1_icp {
            Some(ref pool) => pool,
            None => return Err("Pool not found".to_string()),
        };
        let pool2 = match pool2_icp_ckusdt {
            Some(ref pool) => pool,
            None => return Err("Pool not found".to_string()),
        };
        let swap1_lp_fee = (pool1.lp_fee_bps + 1) / 2;
        // swap token0 to ICP
        let swap1 = swap_amount_0(pool1, pay_amount, Some(user_fee_level), Some(swap1_lp_fee), Some(&nat_zero()))?;
        let swap2_lp_fee = (pool2.lp_fee_bps + 1) / 2;
        // swap ICP to ckUSDT
        let swap2 = swap_amount_0(
            pool2,
            &swap1.receive_amount_with_fees_and_gas(),
            Some(user_fee_level),
            Some(swap2_lp_fee),
            None,
        )?;
        let receive_amount = swap2.receive_amount_with_fees_and_gas();
        let swap1_price = swap1.get_price().ok_or("Invalid swap1 price")?;
        let swap2_price = swap2.get_price().ok_or("Invalid swap2 price")?;
        let price = swap1_price * swap2_price;
        let price_f64 = price_rounded(&price).ok_or("Invalid price")?;
        let swap1_mid_price = swap1.get_mid_price().ok_or("Invalid swap1 mid price")?;
        let swap2_mid_price = swap2.get_mid_price().ok_or("Invalid swap2 mid price")?;
        let mid_price = swap1_mid_price * swap2_mid_price;
        let mid_price_f64 = price_rounded(&mid_price).ok_or("Invalid mid price")?;
        let slippage_f64 = get_slippage(&price, &mid_price).ok_or("Invalid slippage")?;
        txs.push(swap1);
        txs.push(swap2);
        return Ok((receive_amount, price_f64, mid_price_f64, slippage_f64, txs));
    };

    // test for 3-step swap via token0/ckUSDT, ICP/ckUSDT and token1/ICP
    let pool3_icp = pool2_icp;
    if pool1_ckusdt.is_some() && pool2_icp_ckusdt.is_some() && pool3_icp.is_some() {
        let pool1 = match pool1_ckusdt {
            Some(ref pool) => pool,
            None => return Err("Pool not found".to_string()),
        };
        let pool2 = match pool2_icp_ckusdt {
            Some(ref pool) => pool,
            None => return Err("Pool not found".to_string()),
        };
        let pool3 = match pool3_icp {
            Some(ref pool) => pool,
            None => return Err("Pool not found".to_string()),
        };
        let swap1_lp_fee = (pool1.lp_fee_bps + 1) / 3;
        // swap token0 to ckUSDT
        let swap1 = swap_amount_0(
            pool1,
            pay_amount,
            Some(user_fee_level),
            Some(swap1_lp_fee),
            Some(&nat_zero()), // swap1 do not take gas fees
        )?;
        let swap2_lp_fee = (pool2.lp_fee_bps + 1) / 3;
        // swap ckUSDT to ICP (reverse order of pool)
        let swap2 = swap_amount_1(
            pool2,
            &swap1.receive_amount_with_fees_and_gas(),
            Some(user_fee_level),
            Some(swap2_lp_fee),
            Some(&nat_zero()), // swap2 do not take gas fees
        )?;
        let swap3_lp_fee = (pool3.lp_fee_bps + 1) / 3;
        // swap ICP to token1 (reverse order of pool)
        let swap3 = swap_amount_1(
            pool3,
            &swap2.receive_amount_with_fees_and_gas(),
            Some(user_fee_level),
            Some(swap3_lp_fee),
            None,
        )?;
        let receive_amount = swap3.receive_amount_with_fees_and_gas();
        let swap1_price = swap1.get_price().ok_or("Invalid swap1 price")?;
        let swap2_price = swap2.get_price().ok_or("Invalid swap2 price")?;
        let swap3_price = swap3.get_price().ok_or("Invalid swap3 price")?;
        let price = swap1_price * swap2_price * swap3_price;
        let price_f64 = price_rounded(&price).ok_or("Invalid price")?;
        let swap1_mid_price = swap1.get_mid_price().ok_or("Invalid swap1 mid price")?;
        let swap2_mid_price = swap2.get_mid_price().ok_or("Invalid swap2 mid price")?;
        let swap3_mid_price = swap3.get_mid_price().ok_or("Invalid swap3 mid price")?;
        let mid_price = swap1_mid_price * swap2_mid_price * swap3_mid_price;
        let mid_price_f64 = price_rounded(&mid_price).ok_or("Invalid mid price")?;
        let slippage_f64 = get_slippage(&price, &mid_price).ok_or("Invalid slippage")?;
        txs.push(swap1);
        txs.push(swap2);
        txs.push(swap3);
        return Ok((receive_amount, price_f64, mid_price_f64, slippage_f64, txs));
    };

    // test for 3-step swap via token0/ICP, ICP/ckUSDT and token1/ckUSDT
    let pool3_ckusdt = pool2_ckusdt;
    if pool1_icp.is_some() && pool2_icp_ckusdt.is_some() && pool3_ckusdt.is_some() {
        let pool1 = match pool1_icp {
            Some(ref pool) => pool,
            None => return Err("Pool not found".to_string()),
        };
        let pool2 = match pool2_icp_ckusdt {
            Some(ref pool) => pool,
            None => return Err("Pool not found".to_string()),
        };
        let pool3 = match pool3_ckusdt {
            Some(ref pool) => pool,
            None => return Err("Pool not found".to_string()),
        };
        let swap1_lp_fee = (pool1.lp_fee_bps + 1) / 3;
        // swap token0 to ICP
        let swap1 = swap_amount_0(
            pool1,
            pay_amount,
            Some(user_fee_level),
            Some(swap1_lp_fee),
            Some(&nat_zero()), // swap1 do not take gas fees
        )?;
        let swap2_lp_fee = (pool2.lp_fee_bps + 1) / 3;
        // swap ICP to ckUSDT
        let swap2 = swap_amount_0(
            pool2,
            &swap1.receive_amount_with_fees_and_gas(),
            Some(user_fee_level),
            Some(swap2_lp_fee),
            Some(&nat_zero()), // swap2 do not take gas fees
        )?;
        let swap3_lp_fee = (pool3.lp_fee_bps + 1) / 3;
        // swap ckUSDT to token1 (reverse order of pool)
        let swap3 = swap_amount_1(
            pool3,
            &swap2.receive_amount_with_fees_and_gas(),
            Some(user_fee_level),
            Some(swap3_lp_fee),
            None,
        )?;
        let receive_amount = swap3.receive_amount_with_fees_and_gas();
        let swap1_price = swap1.get_price().ok_or("Invalid swap1 price")?;
        let swap2_price = swap2.get_price().ok_or("Invalid swap2 price")?;
        let swap3_price = swap3.get_price().ok_or("Invalid swap3 price")?;
        let price = swap1_price * swap2_price * swap3_price;
        let price_f64 = price_rounded(&price).ok_or("Invalid price")?;
        let swap1_mid_price = swap1.get_mid_price().ok_or("Invalid swap1 mid price")?;
        let swap2_mid_price = swap2.get_mid_price().ok_or("Invalid swap2 mid price")?;
        let swap3_mid_price = swap3.get_mid_price().ok_or("Invalid swap3 mid price")?;
        let mid_price = swap1_mid_price * swap2_mid_price * swap3_mid_price;
        let mid_price_f64 = price_rounded(&mid_price).ok_or("Invalid mid price")?;
        let slippage_f64 = get_slippage(&price, &mid_price).ok_or("Invalid slippage")?;
        txs.push(swap1);
        txs.push(swap2);
        txs.push(swap3);
        return Ok((receive_amount, price_f64, mid_price_f64, slippage_f64, txs));
    };

    Err("Pool not found".to_string())
}

/// Swap amount 0 of a given pool
/// use_lp_fee and use_gas_fee are used to overwrite the default LP and gas fees, if None, then use the pool's default
fn swap_amount_0(
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
fn swap_amount_1(
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

fn get_slippage(price_achieved: &BigRational, price_expected: &BigRational) -> Option<f64> {
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
