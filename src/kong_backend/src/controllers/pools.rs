use candid::Principal;
use ic_cdk::{query, update};
use icrc_ledger_types::icrc1::account::Account;
use std::collections::BTreeMap;

use crate::helpers::nat_helpers::nat_zero;
use crate::ic::guards::caller_is_kingkong;
use crate::remove_liquidity::remove_liquidity::remove_liquidity_from_pool;
use crate::remove_liquidity::remove_liquidity_args::RemoveLiquidityArgs;
use crate::stable_lp_token::lp_token_map;
use crate::stable_memory::{LP_TOKEN_MAP, POOL_MAP, USER_MAP};
use crate::stable_pool::stable_pool::{StablePool, StablePoolId};
use crate::stable_pool::{pool_map, pool_stats};
use crate::stable_token::token::Token;
use crate::stable_user::stable_user::StableUserId;

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

    for (_, v) in pools {
        pool_map::insert(&v)?;
    }

    Ok("Pools updated".to_string())
}

/// remove pool, LP token and all LP positions
#[update(hidden = true, guard = "caller_is_kingkong")]
fn remove_pool(symbol: String) -> Result<String, String> {
    let pool = pool_map::get_by_token(&symbol)?;
    let lp_token_id = pool.lp_token_id;
    let lp_total_supply = lp_token_map::get_total_supply(lp_token_id);
    if lp_total_supply > nat_zero() {
        return Err(format!("LP token total supply is still {}", lp_total_supply));
    }

    pool_map::remove(pool.pool_id)?;

    Ok(format!("Pool {} removed", symbol))
}

#[update(hidden = true, guard = "caller_is_kingkong")]
async fn remove_lps_from_pool(symbol: String) -> Result<String, String> {
    let pool = pool_map::get_by_token(&symbol)?;
    let lp_token_id = pool.lp_token_id;

    // (lp token amount, user_id, principal_id)
    let lp_users = USER_MAP.with(|u| {
        let users = u.borrow();
        LP_TOKEN_MAP.with(|m| {
            m.borrow()
                .iter()
                .filter_map(|(_, v)| {
                    if v.token_id == lp_token_id {
                        let user = users.get(&StableUserId(v.user_id))?;
                        Some((v.amount, user.user_id, user.principal_id))
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>()
        })
    });

    let token_0 = pool.token_0().address_with_chain();
    let token_1 = pool.token_1().address_with_chain();
    let mut results = Vec::new();
    for (remove_lp_token_amount, user_id, principal_id) in lp_users {
        // skip if user has no LP position
        if remove_lp_token_amount == nat_zero() {
            continue;
        }
        let args = RemoveLiquidityArgs {
            token_0: token_0.clone(),
            token_1: token_1.clone(),
            remove_lp_token_amount,
        };
        match Principal::from_text(principal_id) {
            Ok(principal) => {
                let to_principal_id = Account::from(principal);
                match remove_liquidity_from_pool(args, user_id, &to_principal_id).await {
                    Ok(_) => {
                        results.push(format!("Removed user_id {} LP position", user_id));
                    }
                    Err(e) => {
                        results.push(format!("Failed to remove user_id {} LP position: {}", user_id, e));
                    }
                }
            }
            Err(e) => {
                results.push(format!("Failed to parse user_id {} principal id: {}", user_id, e));
            }
        }
    }
    let lp_total_supply = lp_token_map::get_total_supply(lp_token_id);
    results.push(format!("Remaining LP token total supply {}", lp_total_supply));

    serde_json::to_string(&results).map_err(|e| format!("Failed to serialize remove_liquidity: {}", e))
}

#[update(hidden = true, guard = "caller_is_kingkong")]
fn update_pool_tvl(symbol: String) -> Result<String, String> {
    let mut pool = pool_map::get_by_token(&symbol)?;
    pool.set_tvl();
    pool_map::update(&pool);

    serde_json::to_string(&pool).map_err(|e| format!("Failed to serialize: {}", e))
}

#[query(hidden = true, guard = "caller_is_kingkong")]
fn query_pool_stats() -> Result<String, String> {
    pool_stats::update_pool_stats()?;

    Ok("Pool stats updated".to_string())
}

#[update(hidden = true, guard = "caller_is_kingkong")]
fn update_pool_stats() -> Result<String, String> {
    pool_stats::update_pool_stats()?;

    Ok("Pool stats updated".to_string())
}
