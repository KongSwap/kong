use candid::Nat;

use super::pool_map;

use crate::helpers::math_helpers::round_f64;
use crate::helpers::nat_helpers::{nat_add, nat_divide_as_f64, nat_zero};
use crate::ic::get_time::get_time;
use crate::ic::guards::not_in_maintenance_mode;
use crate::ic::logging::info_log;
use crate::stable_memory::TX_24H_MAP;
use crate::stable_tx::stable_tx::StableTx;

pub fn update_pool_stats() {
    if not_in_maintenance_mode().is_err() {
        return;
    }

    info_log("Updating 24h stats...");

    let ts_start = get_time() - 86_400_000_000_000; // 24 hours
    let pools = pool_map::get_on_kong();
    for pool in pools {
        let mut pool = match pool_map::get_by_pool_id(pool.pool_id) {
            Some(pool) => pool,
            None => continue,
        };

        // get all the swaps of the pool for the last 24 hours
        let one = Nat::from(1_u32);
        let (num_swaps, rolling_24h_volume, rolling_24h_lp_fee) = TX_24H_MAP.with(|m| {
            m.borrow()
                .iter()
                .fold((nat_zero(), nat_zero(), nat_zero()), |(num_swaps_acc, vol_acc, fee_acc), swap| {
                    if let StableTx::Swap(swap_tx) = swap.1 {
                        if swap_tx.ts >= ts_start {
                            for tx in swap_tx.txs.iter() {
                                if tx.pool_id == pool.pool_id {
                                    return (
                                        nat_add(&num_swaps_acc, &one),
                                        nat_add(&vol_acc, &tx.receive_amount),
                                        nat_add(&fee_acc, &tx.lp_fee),
                                    );
                                }
                            }
                        }
                    }
                    (num_swaps_acc, vol_acc, fee_acc)
                })
        });
        pool.rolling_24h_num_swaps = num_swaps;
        pool.rolling_24h_volume = rolling_24h_volume;
        pool.rolling_24h_lp_fee = rolling_24h_lp_fee;
        // APY = (total_fees / total_liquidity) * 365 * 100
        pool.rolling_24h_apy = round_f64(
            nat_divide_as_f64(&pool.rolling_24h_lp_fee, &pool.get_balance()).unwrap_or(0_f64) * 365_f64 * 100_f64,
            2,
        );

        pool_map::update(&pool);
    }
}
