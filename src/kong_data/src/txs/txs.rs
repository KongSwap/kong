use ic_cdk::query;

use super::txs_reply::TxsReply;
use super::txs_reply_helpers::to_txs_reply;

use crate::stable_tx::tx_map;
use crate::stable_user::user_map;

#[query]
fn txs(my_txs: Option<bool>, tx_id: Option<u64>, token_id: Option<u32>, num_txs: Option<u16>) -> Result<Vec<TxsReply>, String> {
    let num_txs = num_txs.map(|n| n as usize);
    let txs = match my_txs {
        Some(true) => {
            // return only txs of the caller
            let user_id = match user_map::get_by_caller() {
                Ok(Some(caller)) => caller.user_id,
                Ok(None) | Err(_) => return Ok(Vec::new()),
            };
            tx_map::get_by_user_and_token_id(tx_id, Some(user_id), token_id, num_txs)
        }
        Some(false) | None => {
            // return all txs
            tx_map::get_by_user_and_token_id(tx_id, None, token_id, num_txs)
        }
    }
    .iter()
    .map(to_txs_reply)
    .collect();
    Ok(txs)
}
