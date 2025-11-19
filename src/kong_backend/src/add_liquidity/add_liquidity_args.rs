use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

use kong_lib::stable_transfer::tx_id::TxId;

/// Data structure for the arguments of the `add_liquidity` function.
/// Used in StableRequest
#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct AddLiquidityArgs {
    pub token_0: String,
    pub amount_0: Nat,
    pub tx_id_0: Option<TxId>,
    pub token_1: String,
    pub amount_1: Nat,
    pub tx_id_1: Option<TxId>,
    // Cross-chain signature support (following issue #6 spec)
    pub signature_0: Option<String>,     // Ed25519 signature for token_0 transfer
    pub signature_1: Option<String>,     // Ed25519 signature for token_1 transfer
}
