use ic_cdk::update;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_pool::pool_stats::update_pool_stats;
use crate::stable_tx::tx_archive::archive_tx_24h_map;

#[update(hidden = true, guard = "caller_is_kingkong")]
fn update_24h_stats() -> Result<String, String> {
    archive_tx_24h_map();
    update_pool_stats();

    Ok("updated_24h_stats".to_string())
}
