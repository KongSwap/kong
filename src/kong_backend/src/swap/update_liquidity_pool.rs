use candid::Nat;

use super::calculate_amounts::calculate_amounts;
use super::swap_amounts::ckusdt_amount;
use super::swap_calc::SwapCalc;

use crate::helpers::nat_helpers::nat_divide_as_f64;
use crate::helpers::{
    math_helpers::round_f64,
    nat_helpers::{nat_add, nat_divide, nat_multiply, nat_subtract, nat_zero},
};
use crate::stable_pool::pool_map;
use crate::stable_request::request_map;
use crate::stable_request::status::StatusCode;
use crate::stable_token::stable_token::StableToken;

pub fn update_liquidity_pool(
    request_id: u64,
    pay_token: &StableToken,
    pay_amount: &Nat,
    receive_token: &StableToken,
    receive_amount: Option<&Nat>,
    max_slippage: f64,
) -> Result<(Nat, f64, f64, f64, Vec<SwapCalc>), String> {
    request_map::update_status(request_id, StatusCode::CalculatePoolAmounts, None);

    match calculate_amounts(pay_token, pay_amount, receive_token, receive_amount, max_slippage) {
        Ok((receive_amount, price, mid_price, slippage, swaps)) => {
            request_map::update_status(request_id, StatusCode::CalculatePoolAmountsSuccess, None);

            // update the pool, in some cases there could be multiple pools
            request_map::update_status(request_id, StatusCode::UpdatePoolAmounts, None);
            for swap in &swaps {
                // refresh pool with the latest state
                let mut pool = match pool_map::get_by_pool_id(swap.pool_id) {
                    Some(pool) => pool,
                    None => continue, // should not get here
                };

                if swap.receive_token_id == pool.token_id_1 {
                    // user pays token_0 and receives token_1
                    pool.balance_0 = nat_add(&pool.balance_0, &swap.pay_amount); // pay_amount is in token_0
                    pool.balance_1 = nat_subtract(&pool.balance_1, &swap.receive_amount).unwrap_or(nat_zero()); // receive_amount is in token_1
                    if let Ok((ckusdt_volume, _)) = ckusdt_amount(&pool.token_1(), &swap.receive_amount) {
                        // update 24h stats
                        pool.rolling_24h_volume = nat_add(&pool.rolling_24h_volume, &ckusdt_volume);
                        // update lifetime stats
                        pool.total_volume = nat_add(&pool.total_volume, &ckusdt_volume);
                    }
                    // fees are in token_1. take out Kong's fee
                    // kong_fee_1 = lp_fee * kong_fee_bps / lp_fee_bps
                    // lp_fee_1 = lp_fee - kong_fee_1
                    let numerator = nat_multiply(&swap.lp_fee, &Nat::from(pool.kong_fee_bps)); //swap.lp_fee is in token_1
                    let kong_fee_1 = nat_divide(&numerator, &Nat::from(pool.lp_fee_bps)).unwrap_or(nat_zero());
                    let lp_fee_1 = nat_subtract(&swap.lp_fee, &kong_fee_1).unwrap_or(nat_zero());
                    pool.lp_fee_1 = nat_add(&pool.lp_fee_1, &lp_fee_1);
                    pool.kong_fee_1 = nat_add(&pool.kong_fee_1, &kong_fee_1);
                    if let Ok((ckusdt_lp_fee, _)) = ckusdt_amount(&pool.token_1(), &lp_fee_1) {
                        pool.rolling_24h_lp_fee = nat_add(&pool.rolling_24h_lp_fee, &ckusdt_lp_fee);
                        pool.total_lp_fee = nat_add(&pool.total_lp_fee, &ckusdt_lp_fee);
                    }
                } else {
                    // user pays token_1 and receives token_0
                    pool.balance_1 = nat_add(&pool.balance_1, &swap.pay_amount); // pay_amount is in token_1
                    pool.balance_0 = nat_subtract(&pool.balance_0, &swap.receive_amount).unwrap_or(nat_zero()); // receive_amount is in token_0
                    if let Ok((ckusdt_volume, _)) = ckusdt_amount(&pool.token_0(), &swap.receive_amount) {
                        pool.rolling_24h_volume = nat_add(&pool.rolling_24h_volume, &ckusdt_volume);
                        pool.total_volume = nat_add(&pool.total_volume, &ckusdt_volume);
                    }
                    // fees are in token_0. take out Kong's fee
                    // kong_fee_0 = lp_fee * kong_fee_bps / lp_fee_bps
                    // lp_fee_0 = lp_fee - kong_fee_0
                    let numerator = nat_multiply(&swap.lp_fee, &Nat::from(pool.kong_fee_bps)); //swap.lp_fee is in token_0
                    let kong_fee_0 = nat_divide(&numerator, &Nat::from(pool.lp_fee_bps)).unwrap_or(nat_zero());
                    let lp_fee_0 = nat_subtract(&swap.lp_fee, &kong_fee_0).unwrap_or(nat_zero());
                    pool.lp_fee_0 = nat_add(&pool.lp_fee_0, &lp_fee_0);
                    pool.kong_fee_0 = nat_add(&pool.kong_fee_0, &kong_fee_0);
                    if let Ok((ckusdt_lp_fee, _)) = ckusdt_amount(&pool.token_0(), &lp_fee_0) {
                        pool.rolling_24h_lp_fee = nat_add(&pool.rolling_24h_lp_fee, &ckusdt_lp_fee);
                        pool.total_lp_fee = nat_add(&pool.total_lp_fee, &ckusdt_lp_fee);
                    }
                }
                pool.rolling_24h_num_swaps = nat_add(&pool.rolling_24h_num_swaps, &Nat::from(1_u128));
                // APY = (total_fees / total_liquidity) * 365 * 100
                pool.rolling_24h_apy = round_f64(
                    nat_divide_as_f64(&pool.rolling_24h_lp_fee, &pool.get_balance()).unwrap_or(0_f64) * 365_f64 * 100_f64,
                    2,
                );

                pool_map::update(&pool);
            }

            request_map::update_status(request_id, StatusCode::UpdatePoolAmountsSuccess, None);

            Ok((receive_amount, mid_price, price, slippage, swaps))
        }
        Err(e) => {
            request_map::update_status(request_id, StatusCode::CalculatePoolAmountsFailed, Some(e.clone()));
            Err(e)
        }
    }
}
