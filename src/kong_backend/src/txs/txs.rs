use ic_cdk::query;

use super::txs_reply::TxsReply;
use super::txs_reply_helpers::to_txs_reply;

use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_tx::tx_map;
use crate::stable_user::user_map;

#[query(guard = "not_in_maintenance_mode")]
fn txs(principal_id: Option<String>) -> Result<Vec<TxsReply>, String> {
    let txs = match principal_id {
        Some(principal_id) => {
            let user_id = match user_map::get_by_principal_id(&principal_id) {
                Ok(Some(user)) => user.user_id,
                Ok(None) | Err(_) => return Ok(Vec::new()),
            };
            tx_map::get_by_user_and_token_id(None, Some(user_id), None, None)
        }
        None => tx_map::get_by_user_and_token_id(None, None, None, None),
    }
    .iter()
    .map(to_txs_reply)
    .collect();
    Ok(txs)
}
