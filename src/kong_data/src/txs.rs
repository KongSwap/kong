use ic_cdk::{query, update};
use kong_lib::stable_tx::stable_tx::{StableTx, StableTxId};
use kong_lib::stable_tx::tx::Tx;
use std::collections::BTreeMap;

use super::guards::caller_is_kingkong;
use super::pools::get_by_pool_id;
use super::stable_memory::TX_MAP;

const MAX_TXS: usize = 1_000;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_txs(tx_id: Option<u64>, num_txs: Option<u16>) -> Result<String, String> {
    TX_MAP.with(|m| {
        let map = m.borrow();
        let txs: BTreeMap<_, _> = match tx_id {
            Some(tx_id) => {
                let num_txs = num_txs.map_or(1, |n| n as usize);
                let start_key = StableTxId(tx_id);
                map.range(start_key..).take(num_txs).collect()
            }
            None => {
                let num_txs = num_txs.map_or(MAX_TXS, |n| n as usize);
                map.iter().take(num_txs).collect()
            }
        };

        serde_json::to_string(&txs).map_err(|e| format!("Failed to serialize txs: {}", e))
    })
}

#[update(hidden = true, guard = "caller_is_kingkong")]
fn archive_txs(stable_txs_json: String) -> Result<String, String> {
    let txs: BTreeMap<StableTxId, StableTx> = match serde_json::from_str(&stable_txs_json) {
        Ok(txs) => txs,
        Err(e) => return Err(format!("Invalid txs: {}", e)),
    };

    TX_MAP.with(|tx_map| {
        let mut map = tx_map.borrow_mut();
        for (k, v) in txs.into_iter() {
            map.insert(k, v);
        }
    });

    Ok("Txs archived".to_string())
}

#[query(hidden = true, guard = "caller_is_kingkong")]
fn get_txs(user_id: Option<u32>) -> Result<Vec<StableTx>, String> {
    let txs = get_by_user_and_token_id(user_id, None, 50);
    Ok(txs)
}

/// get txs filtered by user_id and token_id
/// if you call get_by_user_and_token_id(None, None, None) it will return all txs
pub fn get_by_user_and_token_id(user_id: Option<u32>, token_id: Option<u32>, max_txs: usize) -> Vec<StableTx> {
    TX_MAP.with(|m| {
        let mut res = vec![];
        for (_, v) in m.borrow().iter().take(5000) {
            if let Some(user_id) = user_id {
                if v.user_id() == user_id {
                    res.push(v);
                    if res.len() >= max_txs {
                        break;
                    }
                }
            }
        }
        res.iter().rev().cloned().collect()
        /*
        m.borrow()
            .iter()
            .collect::<BTreeMap<_, _>>()
            .iter()
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
                            let token_0 = get_by_pool_id(pool_id).map(|pool| pool.token_id_0)?;
                            let token_1 = get_by_pool_id(pool_id).map(|pool| pool.token_id_1)?;
                            if token_0 == token_id || token_1 == token_id {
                                return Some(v.clone());
                            }
                        }
                        StableTx::AddLiquidity(ref add_liquidity_tx) => {
                            let pool_id = add_liquidity_tx.pool_id;
                            let token_0 = get_by_pool_id(pool_id).map(|pool| pool.token_id_0)?;
                            let token_1 = get_by_pool_id(pool_id).map(|pool| pool.token_id_1)?;
                            if token_0 == token_id || token_1 == token_id {
                                return Some(v.clone());
                            }
                        }
                        StableTx::RemoveLiquidity(ref remove_liquidity_tx) => {
                            let pool_id = remove_liquidity_tx.pool_id;
                            let token_0 = get_by_pool_id(pool_id).map(|pool| pool.token_id_0)?;
                            let token_1 = get_by_pool_id(pool_id).map(|pool| pool.token_id_1)?;
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
            .rev()
            .take(max_txs)
            .collect::<Vec<StableTx>>()
            */
    })
}
