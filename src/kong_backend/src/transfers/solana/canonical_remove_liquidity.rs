use candid::Nat;
use serde::{Deserialize, Serialize};

use crate::helpers::nat_helpers::serialize_amount_as_string;
use crate::remove_liquidity::remove_liquidity_args::RemoveLiquidityArgs;

/// A structure representing the canonical message format for signing liquidity removals
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CanonicalRemoveLiquidityMessage {
    pub token_0: String,
    pub token_1: String,
    #[serde(serialize_with = "serialize_amount_as_string")]
    pub remove_lp_token_amount: Nat,
    pub payout_address_0: Option<String>,
    pub payout_address_1: Option<String>,
}

impl CanonicalRemoveLiquidityMessage {
    /// Create a canonical message from RemoveLiquidityArgs
    pub fn from_remove_liquidity_args(args: &RemoveLiquidityArgs) -> Self {
        Self {
            token_0: args.token_0.clone(),
            token_1: args.token_1.clone(),
            remove_lp_token_amount: args.remove_lp_token_amount.clone(),
            payout_address_0: args.payout_address_0.clone(),
            payout_address_1: args.payout_address_1.clone(),
        }
    }

    /// Serialize to JSON string for signing
    pub fn to_signing_message(&self) -> String {
        serde_json::to_string(self).expect("Failed to serialize message")
    }
}