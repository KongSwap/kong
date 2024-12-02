use std::cmp::min;
use std::ops::Bound;

use super::add_liquidity_tx::AddLiquidityTx;
use super::add_pool_tx::AddPoolTx;
use super::remove_liquidity_tx::RemoveLiquidityTx;
use super::send_tx::SendTx;
use super::stable_tx::StableTx::{AddLiquidity, AddPool, RemoveLiquidity, Send, Swap};
use super::stable_tx::{StableTx, StableTxId};
use super::swap_tx::SwapTx;
use super::tx::Tx;

use crate::ic::logging::error_log;
use crate::stable_kong_settings::kong_settings_map;
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

pub fn insert(tx: &StableTx) -> u64 {
    TX_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let tx_id = kong_settings_map::inc_tx_map_idx();
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

pub fn archive_tx_to_kong_data(tx_id: u64) {
    ic_cdk::spawn(async move {
        let tx = match get_by_user_and_token_id(Some(tx_id), None, None, Some(1)).pop() {
            Some(tx) => tx,
            None => return,
        };

        match serde_json::to_string(&tx) {
            Ok(tx_json) => {
                let kong_data = kong_settings_map::get().kong_data;
                match ic_cdk::call::<(String,), (Result<String, String>,)>(kong_data, "update_tx", (tx_json,))
                    .await
                    .map_err(|e| e.1)
                    .unwrap_or_else(|e| (Err(e),))
                    .0
                {
                    Ok(_) => (),
                    Err(e) => error_log(&format!("Failed to archive tx_id #{}. {}", tx.tx_id(), e)),
                }
            }
            Err(e) => error_log(&format!("Failed to serialize tx_id #{}. {}", tx.tx_id(), e)),
        }
    });
}
