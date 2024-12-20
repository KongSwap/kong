use ic_cdk::query;

use super::txs_reply::TxsReply;
use super::txs_reply_helpers::to_txs_reply;

use crate::stable_tx::tx_map;
use crate::stable_user::user_map;

#[query]
fn txs(principal_id: Option<String>, tx_id: Option<u64>, token_id: Option<u32>, num_txs: Option<u16>) -> Result<Vec<TxsReply>, String> {
    let num_txs = num_txs.map(|n| n as usize);
    let txs = match principal_id {
        Some(principal_id) => {
            let user_id = match user_map::get_by_principal_id(&principal_id) {
                Ok(Some(user)) => user.user_id,
                Ok(None) | Err(_) => return Ok(Vec::new()),
            };
            tx_map::get_by_user_and_token_id(tx_id, Some(user_id), token_id, num_txs)
        }
        None => tx_map::get_by_user_and_token_id(tx_id, None, token_id, num_txs),
    }
    .iter()
    .map(to_txs_reply)
    .collect();
    Ok(txs)
}
