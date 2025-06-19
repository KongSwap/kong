use ic_cdk_macros::{query, update};

use crate::stable_solana_tx::{solana_tx_map, stable_solana_tx::SolanaTransaction};
use crate::ic::guards::caller_is_kingkong;

/// Arguments for updating a Solana transaction
#[derive(candid::CandidType, serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct UpdateSolanaTransactionArgs {
    pub signature: String,
    pub status: String, // e.g., "processed", "confirmed", "finalized", "failed"
    pub metadata: Option<String>,
}

/// Update a Solana transaction in the stable memory
#[update(guard = "caller_is_kingkong")]
pub fn update_solana_transaction(args: UpdateSolanaTransactionArgs) -> Result<(), String> {
    let transaction = SolanaTransaction {
        signature: args.signature.clone(),
        status: args.status,
        metadata: args.metadata,
        timestamp: ic_cdk::api::time(),
    };
    solana_tx_map::insert(args.signature, transaction);
    Ok(())
}

/// Get a Solana transaction by signature
#[query]
pub fn get_solana_transaction(signature: String) -> Option<SolanaTransaction> {
    solana_tx_map::get(&signature)
}

/// Get all Solana transactions (admin only)
#[query(guard = "caller_is_kingkong")]
pub fn get_all_solana_transactions() -> Vec<(String, SolanaTransaction)> {
    solana_tx_map::get_all()
}