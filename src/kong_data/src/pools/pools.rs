use ic_cdk::query;

use super::pools_reply::PoolsReply;
use super::pools_reply_helpers::{to_pool_reply, to_pools_reply};

use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_pool::pool_map;

#[query(guard = "not_in_maintenance_mode")]
fn pools(symbol: Option<String>) -> Result<PoolsReply, String> {
    let pools = match symbol.as_deref() {
        Some(symbol) => pool_map::get_by_token_wildcard(symbol),
        None => pool_map::get(),
    }
    .iter()
    .map(to_pool_reply)
    .collect();
    let reply = to_pools_reply(pools);

    Ok(reply)
}
