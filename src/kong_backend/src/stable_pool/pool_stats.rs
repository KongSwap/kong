use candid::Nat;

use super::pool_map;
use super::stable_pool::StablePoolId;

use crate::canister::guards::not_in_maintenance_mode;
use crate::canister::management::get_time;
use crate::helpers::math_helpers::{price_rounded, round_f64};
use crate::helpers::nat_helpers::{nat_add, nat_divide_as_f64, nat_multiply_f64, nat_to_decimal_precision, nat_zero};
use crate::stable_pool::stable_pool::StablePool;
use crate::stable_token::token::Token;
use crate::stable_tx::stable_tx::StableTx;
use crate::{POOL_MAP, TX_MAP};

pub fn update_pool_stats() {
    if not_in_maintenance_mode().is_err() {
        return;
    }

    let pools = pool_map::get_on_kong();
    pools.iter().for_each(|pool| {
        // Pool
        let pool_id = pool.pool_id;
        // Token 0
        let token_0 = pool.token_0();
        // Token 1
        let token_1 = pool.token_1();
        let ts = get_time();
        let ts_start = ts - 86_400_000_000_000; // 24 hours

        let swaps = TX_MAP.with(|m| {
            // get all the swaps of the pool for the last 24 hours
            m.borrow()
                .iter()
                .filter_map(|(_, v)| {
                    if let StableTx::Swap(swap_tx) = v {
                        if swap_tx.ts < ts_start {
                            return None;
                        }
                        for tx in swap_tx.txs.iter() {
                            if tx.pool_id == pool_id {
                                return Some(tx.clone());
                            }
                        }
                    }
                    None
                })
                .collect::<Vec<_>>()
        });

        let (rolling_24h_volume, rolling_24h_lp_fee) = swaps.iter().fold((nat_zero(), nat_zero()), |acc, swap| -> (Nat, Nat) {
            if swap.receive_token_id == pool.token_id_1 {
                // receive_amount and lp_fee in token_1
                (nat_add(&acc.0, &swap.receive_amount), nat_add(&acc.1, &swap.lp_fee))
            } else {
                // receive_amount and lp_fee in token_0. needs to be converted to token_1
                let receive_amount_decimals = nat_to_decimal_precision(&swap.receive_amount, token_0.decimals(), token_1.decimals());
                let lp_fee_decimals = nat_to_decimal_precision(&swap.lp_fee, token_0.decimals(), token_1.decimals());
                let price_f64 = match swap.get_mid_price() {
                    Some(mid_price) => price_rounded(&mid_price).unwrap_or(0_f64),
                    None => 0_f64,
                };
                let inv_price = if price_f64 == 0_f64 { 0_f64 } else { 1_f64 / price_f64 };
                let receive_amount_in_token_1 = nat_multiply_f64(&receive_amount_decimals, inv_price).unwrap_or(nat_zero());
                let lp_fee_in_token_1 = nat_multiply_f64(&lp_fee_decimals, inv_price).unwrap_or(nat_zero());
                (nat_add(&acc.0, &receive_amount_in_token_1), nat_add(&acc.1, &lp_fee_in_token_1))
            }
        });
        // APY = (total_fees / total_liquidity) * 365 * 100
        let rolling_24h_apy = round_f64(
            nat_divide_as_f64(&rolling_24h_lp_fee, &pool.get_balance()).unwrap_or(0_f64) * 365_f64 * 100_f64,
            2,
        );

        POOL_MAP.with(|pool_map| {
            let mut pool_map = pool_map.borrow_mut();
            let pool = pool_map.get(&StablePoolId(pool.pool_id)).unwrap();
            let pool_new = StablePool {
                rolling_24h_volume,
                rolling_24h_lp_fee,
                rolling_24h_apy,
                ..pool.clone()
            };
            pool_map.insert(StablePoolId(pool.pool_id), pool_new);
        });
    })
}
