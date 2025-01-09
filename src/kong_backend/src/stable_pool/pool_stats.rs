use candid::Nat;
use std::collections::BTreeMap;

use super::pool_map;

use crate::helpers::math_helpers::round_f64;
use crate::helpers::nat_helpers::{nat_add, nat_divide_as_f64, nat_multiply_f64, nat_to_decimal_precision, nat_zero};
use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_memory::TX_24H_MAP;
use crate::stable_token::token::Token;
use crate::stable_token::token_map;
use crate::stable_tx::stable_tx::StableTx;
use crate::swap::swap_amounts::swap_mid_price;

pub fn update_pool_stats() -> Result<(), String> {
    if not_in_maintenance_mode().is_err() {
        return Err("Kong Swap in maintenance mode".to_string());
    }

    let one = Nat::from(1_u32);
    let mut pool_24h_stats = BTreeMap::new();
    let mut usd_mid_rates = BTreeMap::new();
    let ckusdt_token = token_map::get_ckusdt()?;
    TX_24H_MAP.with(|m| {
        let tx_map = m.borrow();
        for (_, tx) in tx_map.iter() {
            if let StableTx::Swap(swap_tx) = tx {
                for swap in swap_tx.txs.iter() {
                    let pool_id = swap.pool_id;
                    if let Some(receive_token) = token_map::get_by_token_id(swap.receive_token_id) {
                        let mid_price = match usd_mid_rates.get(&receive_token.token_id()) {
                            Some(rate) => {
                                if *rate == 0_f64 {
                                    continue;
                                }
                                *rate
                            }
                            None => {
                                let rate = swap_mid_price(&receive_token, &ckusdt_token).unwrap_or(0_f64);
                                if rate == 0_f64 {
                                    continue;
                                }
                                usd_mid_rates.insert(swap.receive_token_id, rate);
                                rate
                            }
                        };
                        let receive_amount_decimal = nat_multiply_f64(&swap.receive_amount, mid_price).unwrap_or(nat_zero());
                        if receive_amount_decimal == nat_zero() {
                            continue;
                        }
                        let receive_amount =
                            nat_to_decimal_precision(&receive_amount_decimal, receive_token.decimals(), ckusdt_token.decimals());

                        let lp_fee_decimal = nat_multiply_f64(&swap.lp_fee, mid_price).unwrap_or(nat_zero());
                        if lp_fee_decimal == nat_zero() {
                            continue;
                        }
                        let lp_fee = nat_to_decimal_precision(&lp_fee_decimal, receive_token.decimals(), ckusdt_token.decimals());

                        let stats = pool_24h_stats.entry(pool_id).or_insert((nat_zero(), nat_zero(), nat_zero()));
                        *stats = (
                            nat_add(&stats.0, &one),
                            nat_add(&stats.1, &receive_amount),
                            nat_add(&stats.2, &lp_fee),
                        );
                    }
                }
            }
        }
    });

    let pools = pool_map::get();
    let thousand = Nat::from(1_000_000_000_u32);
    for mut pool in pools {
        // skip pools with less than $1000 TVL
        if pool.tvl <= thousand {
            continue;
        }

        if let Some((num_swaps, volume, lp_fee)) = pool_24h_stats.get(&pool.pool_id).cloned() {
            pool.rolling_24h_num_swaps = num_swaps;
            pool.rolling_24h_volume = volume;
            pool.rolling_24h_lp_fee = lp_fee;
            // APY = (total_fees / total_liquidity) * 365 * 100
            pool.rolling_24h_apy = round_f64(
                nat_divide_as_f64(&pool.rolling_24h_lp_fee, &pool.tvl).unwrap_or(0_f64) * 365_f64 * 100_f64,
                2,
            );
        } else {
            pool.rolling_24h_num_swaps = nat_zero();
            pool.rolling_24h_volume = nat_zero();
            pool.rolling_24h_lp_fee = nat_zero();
            pool.rolling_24h_apy = 0_f64;
        }
        pool_map::update(&pool);
    }

    Ok(())
}
