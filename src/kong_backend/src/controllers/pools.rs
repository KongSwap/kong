use candid::Nat;
use ic_cdk::{query, update};
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::POOL_MAP;
use crate::stable_pool::pool_map;
use crate::stable_pool::stable_pool::StablePoolId;

const MAX_POOLS: usize = 1_000;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_pools(pool_id: Option<u32>, num_pools: Option<u16>) -> Result<String, String> {
    match pool_id {
        Some(pool_id) if num_pools.is_none() => POOL_MAP.with(|m| {
            let key = StablePoolId(pool_id);
            serde_json::to_string(&m.borrow().get(&key).map_or_else(
                || Err(format!("Pool #{} not found", pool_id)),
                |v| Ok(BTreeMap::new().insert(key, v)),
            )?)
            .map_err(|e| format!("Failed to serialize pools: {}", e))
        }),
        Some(pool_id) => POOL_MAP.with(|m| {
            let num_pools = num_pools.map_or(MAX_POOLS, |n| n as usize);
            let start_key = StablePoolId(pool_id);
            serde_json::to_string(&m.borrow().range(start_key..).take(num_pools).collect::<BTreeMap<_, _>>())
                .map_err(|e| format!("Failed to serialize pools: {}", e))
        }),
        None => POOL_MAP.with(|m| {
            let num_pools = num_pools.map_or(MAX_POOLS, |n| n as usize);
            serde_json::to_string(&m.borrow().iter().take(num_pools).collect::<BTreeMap<_, _>>())
                .map_err(|e| format!("Failed to serialize pools: {}", e))
        }),
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
