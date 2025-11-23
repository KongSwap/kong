use kong_lib::{ic::address::Address, stable_token::solana_token::SolanaToken, stable_transfer::tx_id::TxId};

use crate::solana::{stable_memory::get_solana_transaction, verify_transfer::extract_solana_sender_from_metadata};

pub fn get_caller_address(token: &SolanaToken, tx_id: &TxId) -> Result<Address, String> {
    let tx_id = match tx_id {
        TxId::BlockIndex(nat) => Err(format!(
            "Invalid solana tx_id, expected TransactionId, received BlockIndex({})",
            nat
        ))?,
        TxId::TransactionId(tx_id) => tx_id,
    };

    let transaction = get_solana_transaction(tx_id).ok_or_else(|| {
        format!(
            "Solana transaction {} not found. Make sure kong_rpc has processed this transaction.",
            tx_id
        )
    })?;

    let metadata_json = transaction.metadata.as_ref().ok_or("Transaction metadata is missing")?;

    let metadata: serde_json::Value =
        serde_json::from_str(metadata_json).map_err(|e| format!("Failed to parse transaction metadata: {}", e))?;

    let sender_pubkey = extract_solana_sender_from_metadata(&metadata, token.is_spl_token)?;

    Ok(Address::SolanaAddress(sender_pubkey))
}
