use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

use crate::stable_token::token::Token;
use crate::stable_token::token_map;
use crate::stable_tx::send_tx::SendTx;
use crate::stable_user::user_map;

/// Data structure for the reply of the `send` function.
/// Used in StableRequest
#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct SendReply {
    pub tx_id: u64,
    pub request_id: u64,
    pub status: String,
    pub chain: String,
    pub symbol: String,
    pub amount: Nat,
    pub to_address: String,
    pub ts: u64,
}

impl SendReply {
    pub fn new(send_tx: &SendTx) -> Self {
        Self::new_with_tx_id(send_tx.tx_id, send_tx)
    }

    pub fn new_with_tx_id(tx_id: u64, send_tx: &SendTx) -> Self {
        let (chain, symbol) = token_map::get_by_token_id(send_tx.token_id)
            .map(|token| (token.chain(), token.symbol()))
            .unwrap_or((
                "Token chain not found".to_string(),
                "Token symbol not found".to_string(),
            ));
        let to_address = user_map::get_by_user_id(send_tx.to_user_id)
            .map(|user| user.principal_id)
            .unwrap_or("User principal id not found".to_string());
        Self {
            tx_id,
            request_id: send_tx.request_id,
            status: send_tx.status.to_string(),
            chain,
            symbol,
            amount: send_tx.amount.clone(),
            to_address,
            ts: send_tx.ts,
        }
    }

    pub fn new_failed(request_id: u64, chain: &str, symbol: &str, amount: &Nat, to_address: &str, ts: u64) -> Self {
        Self {
            tx_id: 0,
            request_id,
            status: "Failed".to_string(),
            chain: chain.to_string(),
            symbol: symbol.to_string(),
            amount: amount.clone(),
            to_address: to_address.to_string(),
            ts,
        }
    }
}
