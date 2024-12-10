use candid::Nat;
use std::collections::BTreeMap;

use super::pool_map;

use crate::helpers::math_helpers::round_f64;
use crate::helpers::nat_helpers::{nat_add, nat_divide_as_f64, nat_zero};
use crate::ic::ckusdt::ckusdt_amount;
use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_memory::TX_24H_MAP;
use crate::stable_token::token_map;
use crate::stable_tx::stable_tx::StableTx;

pub fn update_pool_stats() {
    if not_in_maintenance_mode().is_err() {
        return;
    }

    let one = Nat::from(1_u32);
    let mut pool_24h_stats = BTreeMap::new();
    TX_24H_MAP.with(|m| {
        let tx_map = m.borrow();
        for (_, tx) in tx_map.iter() {
            if let StableTx::Swap(swap_tx) = tx {
                for swap in swap_tx.txs.iter() {
                    let pool_id = swap.pool_id;
                    if let Some(receive_token) = token_map::get_by_token_id(swap.receive_token_id) {
                        let receive_amount = ckusdt_amount(&receive_token, &swap.receive_amount).unwrap_or(nat_zero());
                        let lp_fee = ckusdt_amount(&receive_token, &swap.lp_fee).unwrap_or(nat_zero());
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

    let pools = pool_map::get_on_kong();
    for mut pool in pools {
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
}
