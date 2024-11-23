use candid::Nat;

use crate::stable_token::token::Token;
use crate::stable_token::token_map;
use crate::stable_tx::send_tx::SendTx;
use crate::stable_user::user_map;

use super::send_reply::SendReply;

pub fn create_send_reply(send_tx: &SendTx) -> SendReply {
    create_send_reply_with_tx_id(send_tx.tx_id, send_tx)
}

pub fn create_send_reply_with_tx_id(tx_id: u64, send_tx: &SendTx) -> SendReply {
    let (chain, symbol) = token_map::get_by_token_id(send_tx.token_id)
        .map(|token| (token.chain(), token.symbol()))
        .unwrap_or(("Token chain not found".to_string(), "Token symbol not found".to_string()));
    let to_address = user_map::get_by_user_id(send_tx.to_user_id)
        .map(|user| user.principal_id)
        .unwrap_or("User principal id not found".to_string());
    SendReply {
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

pub fn create_send_reply_failed(request_id: u64, chain: &str, symbol: &str, amount: &Nat, to_address: &str, ts: u64) -> SendReply {
    SendReply {
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
