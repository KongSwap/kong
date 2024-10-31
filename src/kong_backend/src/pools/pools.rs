use ic_cdk::query;

use super::pools_reply::PoolsReply;
use super::pools_reply_impl::{to_pool_reply, to_pools_reply};

use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_pool::pool_map;

/// get pools
///
/// # Arguments
/// symbol: Option<String> - "all" returns all pools,
/// otherwise returns the pool with the given symbol
/// None returns pools only listed on Kong
#[query(guard = "not_in_maintenance_mode")]
fn pools(symbol: Option<String>) -> Result<PoolsReply, String> {
    let mut pools = to_pools_reply(match symbol.as_deref() {
        Some("all") => pool_map::get().iter().map(to_pool_reply).collect(),
        Some(symbol) => pool_map::get_by_token_wildcard(symbol).iter().map(to_pool_reply).collect(),
        None => pool_map::get_on_kong().iter().map(to_pool_reply).collect(),
    });
    // order by TVL in reverse order
    pools
        .pools
        .sort_by(|a, b| b.balance.partial_cmp(&a.balance).unwrap_or(std::cmp::Ordering::Equal));
    Ok(pools)
}
