use candid::Principal;
use ic_cdk::{query, update};
use std::collections::BTreeMap;
use std::time::Duration;

use crate::ic::canister_address::{EVENT_STORE, KONG_BACKEND};
use crate::ic::get_time::get_time;
use crate::ic::guards::{caller_is_kingkong, caller_is_kong_backend};
use crate::ic::logging::error_log;
use crate::stable_db_update::db_update_map;
use crate::stable_db_update::stable_db_update::{StableDBUpdate, StableMemory};
use crate::stable_kong_settings::kong_settings_map;
use crate::stable_memory::TX_MAP;
use crate::stable_tx::stable_tx::{StableTx, StableTxId};
use crate::stable_tx::tx::Tx;
use crate::stable_user::user_map;

use super::event_store::{Anonymizable, IdempotentEvent, PushEventsArgs};

const MAX_TXS: usize = 1_000;

#[query(hidden = true)]
fn max_txs_idx() -> u64 {
    TX_MAP.with(|m| m.borrow().last_key_value().map_or(0, |(k, _)| k.0))
}

#[query(hidden = true)]
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
fn update_txs(stable_txs_json: String) -> Result<String, String> {
    let txs: BTreeMap<StableTxId, StableTx> = match serde_json::from_str(&stable_txs_json) {
        Ok(txs) => txs,
        Err(e) => return Err(format!("Invalid txs: {}", e)),
    };

    TX_MAP.with(|tx_map| {
        let mut map = tx_map.borrow_mut();
        for (k, v) in txs {
            map.insert(k, v);
        }
    });

    Ok("Txs updated".to_string())
}

#[update(hidden = true, guard = "caller_is_kong_backend")]
fn update_tx(stable_tx_json: String) -> Result<String, String> {
    let tx: StableTx = match serde_json::from_str(&stable_tx_json) {
        Ok(tx) => tx,
        Err(e) => return Err(format!("Invalid tx: {}", e)),
    };

    TX_MAP.with(|tx_map| {
        let mut map = tx_map.borrow_mut();
        map.insert(StableTxId(tx.tx_id()), tx.clone());
    });

    // add to UpdateMap for archiving to database
    let ts = get_time();
    let update = StableDBUpdate {
        db_update_id: 0,
        stable_memory: StableMemory::TxMap(tx.clone()),
        ts,
    };
    db_update_map::insert(&update);

    // send to event_store for Token Terminal
    let _ = send_to_event_store(&tx);

    Ok("Tx updated".to_string())
}

fn send_to_event_store(tx: &StableTx) -> Result<(), String> {
    if !kong_settings_map::get().archive_to_kong_data {
        return Ok(());
    }

    let ts = get_time();
    let duration = Duration::from_nanos(ts);
    let timestamp = duration.as_millis() as u64;
    let event = match tx {
        StableTx::AddPool(add_pool) => user_map::get_by_user_id(add_pool.user_id).and_then(|user| match serde_json::to_vec(&add_pool) {
            Ok(payload) => Some(IdempotentEvent {
                idempotency_key: add_pool.tx_id.into(),
                name: "AddPool".to_string(),
                timestamp,
                user: Some(Anonymizable::Public(user.principal_id)),
                source: Some(Anonymizable::Public(KONG_BACKEND.to_string())),
                payload,
            }),
            Err(_) => None,
        }),
        StableTx::AddLiquidity(add_liquidity) => {
            user_map::get_by_user_id(add_liquidity.user_id).and_then(|user| match serde_json::to_vec(&add_liquidity) {
                Ok(payload) => Some(IdempotentEvent {
                    idempotency_key: add_liquidity.tx_id.into(),
                    name: "AddLiquidity".to_string(),
                    timestamp,
                    user: Some(Anonymizable::Public(user.principal_id)),
                    source: Some(Anonymizable::Public(KONG_BACKEND.to_string())),
                    payload,
                }),
                Err(_) => None,
            })
        }
        StableTx::RemoveLiquidity(remove_liquidity) => {
            user_map::get_by_user_id(remove_liquidity.user_id).and_then(|user| match serde_json::to_vec(&remove_liquidity) {
                Ok(payload) => Some(IdempotentEvent {
                    idempotency_key: remove_liquidity.tx_id.into(),
                    name: "RemoveLiquidity".to_string(),
                    timestamp,
                    user: Some(Anonymizable::Public(user.principal_id)),
                    source: Some(Anonymizable::Public(KONG_BACKEND.to_string())),
                    payload,
                }),
                Err(_) => None,
            })
        }
        StableTx::Swap(swap) => user_map::get_by_user_id(swap.user_id).and_then(|user| match serde_json::to_vec(&swap) {
            Ok(payload) => Some(IdempotentEvent {
                idempotency_key: swap.tx_id.into(),
                name: "Swap".to_string(),
                timestamp,
                user: Some(Anonymizable::Public(user.principal_id)),
                source: Some(Anonymizable::Public(KONG_BACKEND.to_string())),
                payload,
            }),
            Err(_) => None,
        }),
        _ => None,
    };
    // if event to be forwarded to Token Terminal
    if event.is_some() {
        ic_cdk::spawn(async move {
            if let Ok(event_store) = Principal::from_text(EVENT_STORE) {
                let events = vec![event.unwrap()];
                match ic_cdk::call::<(PushEventsArgs,), ()>(event_store, "push_events", (PushEventsArgs { events },))
                    .await
                    .map_err(|e| e.1)
                {
                    Ok(_) => (),
                    Err(e) => error_log(&format!("Failed to send event to Token Terminal: {}", e)),
                }
            }
        });
    }

    Ok(())
}
