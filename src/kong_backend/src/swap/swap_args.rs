use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

use crate::stable_transfer::tx_id::TxId;

/// Data structure for the arguments of the `swap` function.
/// Used in StableRequest
/// 
/// For cross-chain swaps: signature field determines the operation type
/// - If signature is None: IC-only swap (backward compatible)
/// - If signature is Some: Cross-chain swap (requires timestamp and proper tx_id)
#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct SwapArgs {
    pub pay_token: String,
    pub pay_amount: Nat,
    pub pay_tx_id: Option<TxId>,        // None for IC approve+transfer, Some for cross-chain
    pub receive_token: String,
    pub receive_amount: Option<Nat>,
    pub receive_address: Option<String>, // Required for non-IC receive tokens
    pub max_slippage: Option<f64>,
    pub referred_by: Option<String>,
    // Cross-chain fields (if signature exists, it's cross-chain)
    pub signature: Option<String>,       // Ed25519 signature of canonical message
    pub timestamp: Option<u64>,          // Required when signature is present (milliseconds)
    // NOTE: pay_address removed - we derive sender from pay_tx_id for cross-chain
}
