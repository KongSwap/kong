use candid::Nat;
use serde::{Deserialize, Serialize};

use crate::helpers::nat_helpers::serialize_amount_as_string;
use crate::swap::swap_args::SwapArgs;

/// A structure representing the canonical message format for signing
/// This must serialize to exactly the same JSON format as the frontend
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CanonicalSwapMessage {
    pub pay_token: String,
    #[serde(serialize_with = "serialize_amount_as_string")]
    pub pay_amount: Nat,
    pub pay_address: String,
    pub receive_token: String,
    #[serde(serialize_with = "serialize_amount_as_string")]
    pub receive_amount: Nat,
    pub receive_address: String,
    pub max_slippage: f64,
    pub referred_by: Option<String>,
}

impl CanonicalSwapMessage {
    /// Create a canonical message from SwapArgs
    /// NOTE: This must create a message that serializes identically to the frontend
    pub fn from_swap_args(args: &SwapArgs) -> Self {
        // For cross-chain swaps, we need to use the same values that the frontend used when signing
        // The frontend includes receive_amount and receive_address in the signed message
        let receive_amount = args.receive_amount.as_ref().cloned().unwrap_or_else(|| Nat::from(0u64));

        let receive_address = args.receive_address.clone().unwrap_or_default();

        Self {
            pay_token: args.pay_token.clone(),
            pay_amount: args.pay_amount.clone(),
            pay_address: String::new(), // Will be filled by with_sender for cross-chain
            receive_token: args.receive_token.clone(),
            receive_amount,
            receive_address,
            max_slippage: args.max_slippage.unwrap_or(1.0),
            referred_by: args.referred_by.clone(),
        }
    }

    /// Create a canonical message with a specific sender address
    pub fn with_sender(mut self, sender: String) -> Self {
        self.pay_address = sender;
        self
    }

    /// Serialize to JSON string for signing
    pub fn to_signing_message(&self) -> String {
        serde_json::to_string(self).expect("Failed to serialize message")
    }
}