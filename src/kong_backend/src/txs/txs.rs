use ic_cdk::query;

use super::txs_reply::{to_txs_reply, TxsReply};

use crate::canister::guards::not_in_maintenance_mode;
use crate::stable_tx::tx_map;
use crate::stable_user::user_map;

const MAX_TXS: usize = 50;

#[query(guard = "not_in_maintenance_mode")]
//fn txs(my_txs: Option<bool>, token_id: Option<u32>) -> Result<Vec<TxsReply>, String> {
fn txs(my_txs: Option<bool>) -> Result<Vec<TxsReply>, String> {
    match my_txs {
        Some(true) => {
            // return only txs of the caller, filtered by token_id
            let user_id = match user_map::get_by_caller() {
                Ok(Some(caller)) => caller.user_id,
                Ok(None) | Err(_) => return Ok(Vec::new()),
            };
            /*
            Ok(tx_map::get_by_user_and_token_id(Some(user_id), token_id, Some(MAX_TXS))
                .iter()
                .map(to_txs_reply)
                .collect())
            */
            Ok(tx_map::get_by_user_and_token_id(Some(user_id), None, Some(MAX_TXS))
                .iter()
                .map(to_txs_reply)
                .collect())
        }
        Some(false) | None => {
            // return all txs, filtered by token_id
            /*
            Ok(tx_map::get_by_user_and_token_id(None, token_id, Some(MAX_TXS))
                .iter()
                .map(to_txs_reply)
                .collect())
            */
            Ok(tx_map::get_by_user_and_token_id(None, None, Some(MAX_TXS))
                .iter()
                .map(to_txs_reply)
                .collect())
        }
    }
}