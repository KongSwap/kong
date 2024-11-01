use candid::Nat;

use super::pool_map;

use crate::helpers::math_helpers::round_f64;
use crate::helpers::nat_helpers::{nat_add, nat_divide_as_f64, nat_zero};
use crate::ic::ckusdt::ckusdt_amount;
use crate::ic::get_time::get_time;
use crate::ic::guards::not_in_maintenance_mode;
use crate::ic::logging::info_log;
use crate::stable_memory::TX_24H_MAP;
use crate::stable_token::token_map;
use crate::stable_tx::stable_tx::StableTx;

pub fn update_pool_stats() {
    if not_in_maintenance_mode().is_err() {
        return;
    }

    info_log("Updating 24h stats...");

    let ts = get_time();
    let ts_start = ts - 86_400_000_000_000; // 24 hours
    let pools = pool_map::get_on_kong();
    for pool in pools {
        let mut pool = match pool_map::get_by_pool_id(pool.pool_id) {
            Some(pool) => pool,
            None => continue,
        };

        // get all the swaps of the pool for the last 24 hours
        let swaps = TX_24H_MAP.with(|m| {
            m.borrow()
                .iter()
                .filter_map(|(_, v)| {
                    if let StableTx::Swap(swap_tx) = v {
                        if swap_tx.ts < ts_start {
                            return None;
                        }
                        for tx in swap_tx.txs.iter() {
                            if tx.pool_id == pool.pool_id {
                                return Some(tx.clone());
                            }
                        }
                    }
                    None
                })
                .collect::<Vec<_>>()
        });

        let (rolling_24h_volume, rolling_24h_lp_fee) = swaps.iter().fold((nat_zero(), nat_zero()), |acc, swap| -> (Nat, Nat) {
            if let Some(receive_token) = token_map::get_by_token_id(swap.receive_token_id) {
                let receive_amount = ckusdt_amount(&receive_token, &swap.receive_amount).unwrap_or(nat_zero());
                let lp_fee = ckusdt_amount(&receive_token, &swap.lp_fee).unwrap_or(nat_zero());
                return (nat_add(&acc.0, &receive_amount), nat_add(&acc.1, &lp_fee));
            }
            (acc.0, acc.1)
        });
        pool.rolling_24h_volume = rolling_24h_volume;
        pool.rolling_24h_lp_fee = rolling_24h_lp_fee;
        pool.rolling_24h_num_swaps = Nat::from(swaps.len() as u128);
        // APY = (total_fees / total_liquidity) * 365 * 100
        pool.rolling_24h_apy = round_f64(
            nat_divide_as_f64(&pool.rolling_24h_lp_fee, &pool.get_balance()).unwrap_or(0_f64) * 365_f64 * 100_f64,
            2,
        );

        pool_map::update(&pool);
    }
}
