use ic_cdk::query;

use super::txs_reply::TxsReply;
use super::txs_reply_helpers::to_txs_reply;

use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_tx::tx_map;
use crate::stable_user::user_map;

#[query(guard = "not_in_maintenance_mode")]
fn txs(my_txs: Option<bool>) -> Result<Vec<TxsReply>, String> {
    let txs = match my_txs {
        Some(true) => {
            // return only txs of the caller
            let user_id = match user_map::get_by_caller() {
                Ok(Some(caller)) => caller.user_id,
                Ok(None) | Err(_) => return Ok(Vec::new()),
            };
            tx_map::get_by_user_and_token_id(None, Some(user_id), None, None)
        }
        Some(false) | None => tx_map::get_by_user_and_token_id(None, None, None, None),
    }
    .iter()
    .map(to_txs_reply)
    .collect();
    Ok(txs)
}
