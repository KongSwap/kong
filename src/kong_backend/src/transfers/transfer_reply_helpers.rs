use crate::chains::chains::IC_CHAIN;
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::token_map;
use crate::stable_transfer::transfer_map;
use crate::stable_transfer::tx_id::TxId;

use super::transfer_reply::{ICTransferReply, TransferIdReply, TransferReply};

pub fn to_transfer_ids(transfer_ids: &[u64]) -> Vec<TransferIdReply> {
    transfer_ids.iter().filter_map(|&transfer_id| to_transfer_id(transfer_id)).collect()
}

pub fn to_transfer_id(transfer_id: u64) -> Option<TransferIdReply> {
    match transfer_map::get_by_transfer_id(transfer_id) {
        Some(transfer) => match token_map::get_by_token_id(transfer.token_id) {
            Some(StableToken::IC(token)) => match transfer.tx_id {
                TxId::BlockIndex(block_index) => Some(TransferIdReply {
                    transfer_id,
                    transfer: TransferReply::IC(ICTransferReply {
                        chain: IC_CHAIN.to_string(),
                        symbol: token.symbol,
                        is_send: transfer.is_send,
                        amount: transfer.amount,
                        canister_id: token.canister_id.to_string(),
                        block_index,
                    }),
                }),
                _ => None,
            },
            _ => None,
        },
        _ => None,
    }
}
