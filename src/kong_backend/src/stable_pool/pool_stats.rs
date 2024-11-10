use candid::Nat;
use std::collections::BTreeMap;

use super::pool_map;

use crate::helpers::math_helpers::round_f64;
use crate::helpers::nat_helpers::{nat_add, nat_divide_as_f64, nat_zero};
use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_memory::TX_24H_MAP;
use crate::stable_tx::stable_tx::StableTx;

pub fn update_pool_stats() {
    if not_in_maintenance_mode().is_err() {
        return;
    }

    let one = Nat::from(1_u32);
    let mut pool_24h_stats = BTreeMap::new();
    TX_24H_MAP.with(|m| {
        let tx_map = m.borrow();
        for tx in tx_map.iter() {
            if let StableTx::Swap(swap_tx) = tx.1 {
                for tx in swap_tx.txs.iter() {
                    let pool_id = tx.pool_id;
                    let stats = pool_24h_stats.entry(pool_id).or_insert((nat_zero(), nat_zero(), nat_zero()));
                    *stats = (
                        nat_add(&stats.0, &one),
                        nat_add(&stats.1, &tx.receive_amount),
                        nat_add(&stats.2, &tx.lp_fee),
                    );
                }
            }
        }
    });

    let pools = pool_map::get_on_kong();
    for mut pool in pools {
        if let Some(stats) = pool_24h_stats.get(&pool.pool_id) {
            pool.rolling_24h_num_swaps = stats.0.clone();
            pool.rolling_24h_volume = stats.1.clone();
            pool.rolling_24h_lp_fee = stats.2.clone();
            // APY = (total_fees / total_liquidity) * 365 * 100
            pool.rolling_24h_apy = round_f64(
                nat_divide_as_f64(&pool.rolling_24h_lp_fee, &pool.get_balance()).unwrap_or(0_f64) * 365_f64 * 100_f64,
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
