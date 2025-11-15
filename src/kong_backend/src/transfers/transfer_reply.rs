use candid::{CandidType, Deserialize, Nat};
use serde::Serialize;

use kong_lib::chains::chains::{IC_CHAIN, SOL_CHAIN};
use kong_lib::stable_token::stable_token::StableToken;
use kong_lib::stable_transfer::stable_transfer::StableTransfer;
use kong_lib::stable_transfer::tx_id::TxId;

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct TransferIdReply {
    pub transfer_id: u64,
    pub transfer: TransferReply,
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub enum TransferReply {
    IC(ICTransferReply),
    Solana(SolanaTransferReply),
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct ICTransferReply {
    pub chain: String,
    pub symbol: String,
    pub is_send: bool, // from user's perspective. so if is_send is true, it means the user is sending the token
    pub amount: Nat,
    pub canister_id: String,
    pub block_index: Nat,
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct SolanaTransferReply {
    pub chain: String,
    pub symbol: String,
    pub is_send: bool, // from user's perspective. so if is_send is true, it means the user is sending the token
    pub amount: Nat,
    pub mint_address: String,
    pub signature: String,
}

impl From<ICTransferReply> for TransferReply {
    fn from(reply: ICTransferReply) -> Self {
        TransferReply::IC(reply)
    }
}

impl From<SolanaTransferReply> for TransferReply {
    fn from(reply: SolanaTransferReply) -> Self {
        TransferReply::Solana(reply)
    }
}

impl TryFrom<(u64, &StableTransfer, &StableToken)> for TransferIdReply {
    type Error = String;

    fn try_from((transfer_id, transfer, token): (u64, &StableTransfer, &StableToken)) -> Result<Self, Self::Error> {
        match token {
            // Case 1: The token is an IC token
            StableToken::IC(token) => match &transfer.tx_id {
                TxId::BlockIndex(block_index) => Ok(TransferIdReply {
                    transfer_id,
                    transfer: ICTransferReply {
                        chain: IC_CHAIN.to_string(),
                        symbol: token.symbol.clone(),
                        is_send: transfer.is_send,
                        amount: transfer.amount.clone(),
                        canister_id: token.canister_id.to_string(),
                        block_index: block_index.clone(),
                    }
                    .into(),
                }),
                _ => Err("A BlockIndex is expected for IC tokens".to_string()),
            },
            // Case 2: The token is a Solana token
            StableToken::Solana(token) => match &transfer.tx_id {
                TxId::TransactionId(signature) => Ok(TransferIdReply {
                    transfer_id,
                    transfer: SolanaTransferReply {
                        chain: SOL_CHAIN.to_string(),
                        symbol: token.symbol.clone(),
                        is_send: transfer.is_send,
                        amount: transfer.amount.clone(),
                        mint_address: token.mint_address.clone(),
                        signature: signature.clone(),
                    }
                    .into(),
                }),
                _ => Err("A TransactionId is expected for Solana tokens".to_string()),
            },
            _ => Err("Unsupported token type".to_string()),
        }
    }
}
