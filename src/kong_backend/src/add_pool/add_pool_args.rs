use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

use crate::stable_transfer::tx_id::TxId;

/// Data structure for the arguments of the `add_pool` function.
/// Used in StableRequest
/// 
/// For cross-chain pool creation: signature fields determine the operation type
/// - If signature_0/signature_1 is None: IC-only transfer (backward compatible)
/// - If signature_0/signature_1 is Some: Cross-chain transfer (requires timestamp)
#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct AddPoolArgs {
    pub token_0: String,
    pub amount_0: Nat,
    pub tx_id_0: Option<TxId>,
    pub token_1: String,
    pub amount_1: Nat,
    pub tx_id_1: Option<TxId>,
    pub lp_fee_bps: Option<u8>,
    // Cross-chain fields (if signature exists, it's cross-chain)
    pub signature_0: Option<String>,     // Ed25519 signature for token_0 transfer
    pub signature_1: Option<String>,     // Ed25519 signature for token_1 transfer
    pub timestamp: Option<u64>,          // Required when signatures are present (milliseconds)
}
