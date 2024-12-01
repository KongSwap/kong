use ic_cdk::{query, update};
use std::collections::BTreeMap;

use crate::ic::guards::{caller_is_kingkong, caller_is_kong_backend};
use crate::stable_memory::POOL_MAP;
use crate::stable_pool::stable_pool::{StablePool, StablePoolId};

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

#[update(hidden = true, guard = "caller_is_kong_backend")]
fn update_pool(stable_pool_json: String) -> Result<String, String> {
    let pool: StablePool = match serde_json::from_str(&stable_pool_json) {
        Ok(pool) => pool,
        Err(e) => return Err(format!("Invalid pool: {}", e)),
    };

    POOL_MAP.with(|pool_map| {
        let mut map = pool_map.borrow_mut();
        map.insert(StablePoolId(pool.pool_id), pool);
    });

    Ok("Pool updated".to_string())
}
