use super::stable_tx::{StableTx, StableTxId};
use super::tx::Tx;
use std::cmp::min;
use std::ops::Bound;

use crate::stable_memory::TX_MAP;
use crate::stable_pool::pool_map;

const MAX_TXS: usize = 20;

/// get txs filtered by user_id and token_id
/// if you call get_by_user_and_token_id(None, None, None) it will return all txs
pub fn get_by_user_and_token_id(
    start_tx_id: Option<u64>,
    user_id: Option<u32>,
    token_id: Option<u32>,
    num_txs: Option<usize>,
) -> Vec<StableTx> {
    TX_MAP.with(|m| {
        let map = m.borrow();
        let start_tx_id = start_tx_id.unwrap_or(map.last_key_value().map_or(0, |(k, _)| k.0));
        let num_txs = match num_txs {
            Some(num_txs) => min(num_txs, MAX_TXS),
            None => 1,
        };
        map.range((Bound::Unbounded, Bound::Included(&StableTxId(start_tx_id))))
            .rev()
            .filter_map(|(_, v)| {
                if let Some(user_id) = user_id {
                    if v.user_id() != user_id {
                        return None;
                    }
                }
                if let Some(token_id) = token_id {
                    match v {
                        StableTx::AddPool(ref add_pool_tx) => {
                            let pool_id = add_pool_tx.pool_id;
                            let token_0 = pool_map::get_by_pool_id(pool_id).map(|pool| pool.token_id_0)?;
                            let token_1 = pool_map::get_by_pool_id(pool_id).map(|pool| pool.token_id_1)?;
                            if token_0 == token_id || token_1 == token_id {
                                return Some(v.clone());
                            }
                        }
                        StableTx::AddLiquidity(ref add_liquidity_tx) => {
                            let pool_id = add_liquidity_tx.pool_id;
                            let token_0 = pool_map::get_by_pool_id(pool_id).map(|pool| pool.token_id_0)?;
                            let token_1 = pool_map::get_by_pool_id(pool_id).map(|pool| pool.token_id_1)?;
                            if token_0 == token_id || token_1 == token_id {
                                return Some(v.clone());
                            }
                        }
                        StableTx::RemoveLiquidity(ref remove_liquidity_tx) => {
                            let pool_id = remove_liquidity_tx.pool_id;
                            let token_0 = pool_map::get_by_pool_id(pool_id).map(|pool| pool.token_id_0)?;
                            let token_1 = pool_map::get_by_pool_id(pool_id).map(|pool| pool.token_id_1)?;
                            if token_0 == token_id || token_1 == token_id {
                                return Some(v.clone());
                            }
                        }
                        StableTx::Swap(ref swap_tx) => {
                            for tx in swap_tx.txs.iter() {
                                if tx.pay_token_id == token_id || tx.receive_token_id == token_id {
                                    return Some(v.clone());
                                }
                            }
                        }
                        StableTx::Send(ref send_tx) => {
                            if send_tx.token_id == token_id {
                                return Some(v.clone());
                            }
                        }
                    }
                    return None;
                }
                Some(v.clone())
            })
            .take(num_txs)
            .collect()
    })
}
