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

/// get a tx by tx_id of the caller
pub fn get_by_tx_and_user_id(tx_id: u64, user_id: Option<u32>) -> Option<StableTx> {
    TX_MAP.with(|m| {
        m.borrow().get(&StableTxId(tx_id)).and_then(|v| {
            if let Some(user_id) = user_id {
                if v.user_id() != user_id {
                    return None;
                }
            }
            Some(v)
        })
    })
}

/// get txs filtered by user_id and token_id
/// if you call get_by_user_and_token_id(None, None, None) it will return all txs
pub fn get_by_user_and_token_id(user_id: Option<u32>, token_id: Option<u32>, max_txs: usize) -> Vec<StableTx> {
    TX_MAP.with(|m| {
        m.borrow()
            .iter()
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
            .take(max_txs)
            .collect::<Vec<StableTx>>()
    })
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
