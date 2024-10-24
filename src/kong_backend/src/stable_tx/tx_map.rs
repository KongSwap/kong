use std::cmp::Reverse;

use super::add_liquidity_tx::AddLiquidityTx;
use super::add_pool_tx::AddPoolTx;
use super::remove_liquidity_tx::RemoveLiquidityTx;
use super::send_tx::SendTx;
use super::stable_tx::StableTx::{AddLiquidity, AddPool, RemoveLiquidity, Send, Swap};
use super::stable_tx::{StableTx, StableTxId};
use super::swap_tx::SwapTx;
use super::tx::Tx;

use crate::stable_kong_settings::kong_settings;
use crate::stable_memory::TX_MAP;
use crate::stable_pool::pool_map;

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

pub fn insert(tx: &StableTx) -> u64 {
    TX_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let tx_id = kong_settings::inc_tx_map_idx();
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
