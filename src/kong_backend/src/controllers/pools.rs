use candid::Nat;
use ic_cdk::{query, update};
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::POOL_MAP;
use crate::stable_pool::pool_map;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_pools(pool_id: Option<u32>) -> Result<String, String> {
    match pool_id {
        Some(pool_id) => POOL_MAP.with(|m| {
            m.borrow().iter().find(|(k, _)| k.0 == pool_id).map_or_else(
                || Err(format!("Pool #{} not found", pool_id)),
                |(k, v)| serde_json::to_string(&(k, v)).map_err(|e| format!("Failed to serialize pool: {}", e)),
            )
        }),
        None => {
            let pools: BTreeMap<_, _> = POOL_MAP.with(|m| m.borrow().iter().collect());
            serde_json::to_string(&pools).map_err(|e| format!("Failed to serialize pools: {}", e))
        }
    }
}

#[update(hidden = true, guard = "caller_is_kingkong")]
fn update_pool(symbol: String, balance_0: Nat, balance_1: Nat) -> Result<String, String> {
    let mut pool = pool_map::get_by_token(&symbol)?;
    pool.balance_0 = balance_0;
    pool.balance_1 = balance_1;
    _ = pool_map::update(&pool);

    Ok(format!("Pool {} updated", symbol))
}

#[update(hidden = true, guard = "caller_is_kingkong")]
fn remove_pool(symbol: String) -> Result<String, String> {
    let pool = pool_map::get_by_token(&symbol)?;
    pool_map::remove(&pool)?;

    Ok(format!("Pool {} removed", symbol))
}
