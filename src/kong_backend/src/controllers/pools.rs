use candid::Nat;
use ic_cdk::{query, update};
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::{POOL_ALT_MAP, POOL_ARCHIVE_MAP, POOL_MAP};
use crate::stable_pool::pool_archive::archive_pool_map;
use crate::stable_pool::pool_map;
use crate::stable_pool::stable_pool::{StablePool, StablePoolId};
use crate::stable_pool::stable_pool_alt::{StablePoolAlt, StablePoolIdAlt};

const MAX_POOLS: usize = 1_000;

/// serializes POOL_MAP for backup
#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_pools(pool_id: Option<u32>, num_pools: Option<u16>) -> Result<String, String> {
    POOL_MAP.with(|m| {
        let map = m.borrow();
        let pools: BTreeMap<_, _> = match pool_id {
            Some(pool_id) => {
                let start_id = StablePoolId(pool_id);
                let num_pools = num_pools.map_or(1, |n| n as usize);
                map.range(start_id..).take(num_pools).collect()
            }
            None => {
                let num_pools = num_pools.map_or(MAX_POOLS, |n| n as usize);
                map.iter().take(num_pools).collect()
            }
        };
        serde_json::to_string(&pools).map_err(|e| format!("Failed to serialize pools: {}", e))
    })
}

/// deserialize POOL_MAP and update stable memory
#[update(hidden = true, guard = "caller_is_kingkong")]
fn update_pools(tokens: String) -> Result<String, String> {
    let pools: BTreeMap<StablePoolId, StablePool> = match serde_json::from_str(&tokens) {
        Ok(pools) => pools,
        Err(e) => return Err(format!("Invalid pools: {}", e)),
    };

    POOL_MAP.with(|user_map| {
        let mut map = user_map.borrow_mut();
        for (k, v) in pools {
            map.insert(k, v);
        }
    });

    Ok("Pools updated".to_string())
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

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_archive_pools(pool_id: Option<u32>, num_pools: Option<u16>) -> Result<String, String> {
    POOL_ARCHIVE_MAP.with(|m| {
        let map = m.borrow();
        let pools: BTreeMap<_, _> = match pool_id {
            Some(pool_id) => {
                let start_id = StablePoolId(pool_id);
                let num_pools = num_pools.map_or(1, |n| n as usize);
                map.range(start_id..).take(num_pools).collect()
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
fn upgrade_alt_pools() -> Result<String, String> {
    archive_pool_map();

    POOL_MAP.with(|pool_map| {
        for (k, v) in pool_map.borrow().iter() {
            let pool_id = StablePoolIdAlt::from_stable_pool_id(&k);
            let pool = StablePoolAlt::from_stable_pool(&v);
            POOL_ALT_MAP.with(|m| {
                m.borrow_mut().insert(pool_id, pool);
            });
        }
    });

    Ok("Alt pools upgraded".to_string())
}
