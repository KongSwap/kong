use candid::Nat;
use std::cmp::Reverse;

use super::add_liquidity_tx::AddLiquidityTx;
use super::add_pool_tx::AddPoolTx;
use super::remove_liquidity_tx::RemoveLiquidityTx;
use super::send_tx::SendTx;
use super::stable_tx::StableTx::{AddLiquidity, AddPool, RemoveLiquidity, Send, Swap};
use super::stable_tx::{StableTx, StableTxId};
use super::swap_tx::SwapTx;
use super::tx::Tx;

use crate::canister::management::get_time;
use crate::helpers::math_helpers::{price_rounded, round_f64};
use crate::helpers::nat_helpers::{nat_add, nat_divide_as_f64, nat_multiply_f64, nat_to_decimal_precision, nat_zero};
use crate::stable_pool::pool_map;
use crate::stable_pool::stable_pool::StablePool;
use crate::stable_token::token::Token;
use crate::swap::swap_calc::SwapCalc;
use crate::TX_MAP;

#[allow(dead_code)]
pub fn get_by_tx_id(tx_id: u64) -> Option<StableTx> {
    TX_MAP.with(|m| m.borrow().get(&StableTxId(tx_id)))
}

/// get all txs filtered by user_id and token_id
/// if you call get_by_user_and_token_id(None, None, None) it will return all txs
pub fn get_by_user_and_token_id(user_id: Option<u32>, token_id: Option<u32>, max_txs: Option<usize>) -> Vec<StableTx> {
    let mut txs: Vec<StableTx> = TX_MAP.with(|m| {
        m.borrow()
            .iter()
            .filter_map(|(_, v)| {
                if let Some(user_id) = user_id {
                    // if user specified, make sure it matches
                    if v.user_id() != user_id {
                        return None;
                    }
                }
                if let Some(token_id) = token_id {
                    // if token specified, make sure it matches
                    match v {
                        StableTx::AddPool(ref add_pool_tx) => {
                            let pool_id = add_pool_tx.pool_id;
                            let token_0 = pool_map::get_by_pool_id(pool_id).map(|pool| pool.token_id_0)?;
                            let token_1 = pool_map::get_by_pool_id(pool_id).map(|pool| pool.token_id_1)?;
                            if token_0 == token_id || token_1 == token_id {
                                return Some(v);
                            }
                        }
                        StableTx::AddLiquidity(ref add_liquidity_tx) => {
                            let pool_id = add_liquidity_tx.pool_id;
                            let token_0 = pool_map::get_by_pool_id(pool_id).map(|pool| pool.token_id_0)?;
                            let token_1 = pool_map::get_by_pool_id(pool_id).map(|pool| pool.token_id_1)?;
                            if token_0 == token_id || token_1 == token_id {
                                return Some(v);
                            }
                        }
                        StableTx::RemoveLiquidity(ref remove_liquidity_tx) => {
                            let pool_id = remove_liquidity_tx.pool_id;
                            let token_0 = pool_map::get_by_pool_id(pool_id).map(|pool| pool.token_id_0)?;
                            let token_1 = pool_map::get_by_pool_id(pool_id).map(|pool| pool.token_id_1)?;
                            if token_0 == token_id || token_1 == token_id {
                                return Some(v);
                            }
                        }
                        StableTx::Swap(ref swap_tx) => {
                            for tx in swap_tx.txs.iter() {
                                if tx.pay_token_id == token_id || tx.receive_token_id == token_id {
                                    return Some(v);
                                }
                            }
                        }
                        StableTx::Send(ref send_tx) => {
                            if send_tx.token_id == token_id {
                                return Some(v);
                            }
                        }
                    }
                    // no match of user_id or token_id
                    return None;
                }
                // no user_id or token_id specified, return all
                Some(v)
            })
            .collect()
    });
    // order by timestamp in reverse order
    txs.sort_by_key(|tx| Reverse(tx.ts()));
    if let Some(max_requests) = max_txs {
        txs.truncate(max_requests);
    }
    txs
}

/// calculates the rolling 24 hour stats for the pool
/// (rolling_24h_volume, rolling_24h_lp_fee, rolling_24h_num_swaps, rolling_24h_apy)
pub fn get_24h_stats(pool: &StablePool) -> (Nat, Nat, Nat, f64) {
    let ts = get_time();
    let ts_start = ts - 86_400_000_000_000; // 24 hours
                                            // get all the swaps (by pool) for the last 24 hours
    let swaps = TX_MAP.with(|m| {
        m.borrow()
            .iter()
            .filter_map(|(_, v)| {
                if let StableTx::Swap(swap_tx) = v {
                    // make sure within 24 hours and self_id matches
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
            .collect::<Vec<SwapCalc>>()
    });

    let (rolling_24h_volume, rolling_24h_lp_fee) =
        swaps.iter().fold((nat_zero(), nat_zero()), |acc, swap| -> (Nat, Nat) {
            if swap.receive_token_id == pool.token_id_1 {
                // receive_amount and lp_fee in token_1
                (nat_add(&acc.0, &swap.receive_amount), nat_add(&acc.1, &swap.lp_fee))
            } else {
                // receive_amount and lp_fee in token_0. needs to be converted to token_1
                let token_0 = pool.token_0();
                let token_1 = pool.token_1();
                let receive_amount_decimals =
                    nat_to_decimal_precision(&swap.receive_amount, token_0.decimals(), token_1.decimals());
                let lp_fee_decimals = nat_to_decimal_precision(&swap.lp_fee, token_0.decimals(), token_1.decimals());
                let price_f64 = match swap.get_mid_price() {
                    Some(mid_price) => price_rounded(&mid_price).unwrap_or(0_f64),
                    None => 0_f64,
                };
                let inv_price = if price_f64 == 0_f64 { 0_f64 } else { 1_f64 / price_f64 };
                let receive_amount_in_token_1 =
                    nat_multiply_f64(&receive_amount_decimals, inv_price).unwrap_or(nat_zero());
                let lp_fee_in_token_1 = nat_multiply_f64(&lp_fee_decimals, inv_price).unwrap_or(nat_zero());
                (
                    nat_add(&acc.0, &receive_amount_in_token_1),
                    nat_add(&acc.1, &lp_fee_in_token_1),
                )
            }
        });
    // APY = (total_fees / total_liquidity) * 365 * 100
    let rolling_24h_apy = round_f64(
        nat_divide_as_f64(&rolling_24h_lp_fee, &pool.get_balance()).unwrap_or(0_f64) * 365_f64 * 100_f64,
        2,
    );

    (
        rolling_24h_volume,
        rolling_24h_lp_fee,
        Nat::from(swaps.len() as u128),
        rolling_24h_apy,
    )
}

pub fn insert(tx: &StableTx) -> u64 {
    TX_MAP.with(|m| {
        let mut map = m.borrow_mut();
        // with lock, increase request id key
        let tx_id = map.iter()
            .map(|(k, _)| k.0)
            .max()
            .unwrap_or(0) // only if empty and first request
            + 1;
        let insert_tx = match tx {
            AddPool(tx) => AddPool(AddPoolTx { tx_id, ..tx.clone() }),
            AddLiquidity(tx) => AddLiquidity(AddLiquidityTx { tx_id, ..tx.clone() }),
            RemoveLiquidity(tx) => RemoveLiquidity(RemoveLiquidityTx { tx_id, ..tx.clone() }),
            Swap(tx) => Swap(SwapTx { tx_id, ..tx.clone() }),
            Send(tx) => Send(SendTx { tx_id, ..tx.clone() }),
        };
        map.insert(StableTxId(tx_id), insert_tx);
        tx_id
    })
}
