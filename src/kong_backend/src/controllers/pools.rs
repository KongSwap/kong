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
    POOL_MAP.with(|m| {
        let map = m.borrow();
        let pools: BTreeMap<_, _> = match pool_id {
            Some(pool_id) => {
                let num_pools = num_pools.map_or(1, |n| n as usize);
                let start_key = StablePoolId(pool_id);
                map.range(start_key..).take(num_pools).collect()
            }
            None => {
                let num_pools = num_pools.map_or(MAX_POOLS, |n| n as usize);
                map.iter().take(num_pools).collect()
            }
        };

        serde_json::to_string(&pools).map_err(|e| format!("Failed to serialize pools: {}", e))
    })
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
