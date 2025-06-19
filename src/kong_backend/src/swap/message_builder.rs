use num_traits::ToPrimitive;
use serde::{Deserialize, Serialize};

use crate::ic::network::ICNetwork;

use super::swap_args::SwapArgs;

/// A structure representing the canonical message format for signing
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CanonicalSwapMessage {
    pub pay_token: String,
    pub pay_amount: u64,
    pub pay_address: String,
    pub receive_token: String,
    pub receive_amount: u64,
    pub receive_address: String,
    pub max_slippage: f64,
    pub timestamp: u64,
    pub referred_by: Option<String>,
}

impl CanonicalSwapMessage {
    /// Create a canonical message from SwapArgs
    /// NOTE: For backward compatibility, we keep pay_address in the message structure
    /// but it will be empty for IC-only swaps
    pub fn from_swap_args(args: &SwapArgs) -> Self {
        Self {
            pay_token: args.pay_token.clone(),
            pay_amount: args.pay_amount.0.to_u64().expect("Amount too large"),
            pay_address: String::new(), // Will be filled by with_sender for cross-chain
            receive_token: args.receive_token.clone(),
            receive_amount: args
                .receive_amount
                .as_ref()
                .map(|n| n.0.to_u64().expect("Amount too large"))
                .unwrap_or(0),
            receive_address: args.receive_address.clone().unwrap_or_default(),
            max_slippage: args.max_slippage.unwrap_or(1.0),
            timestamp: args
                .timestamp
                .unwrap_or_else(|| ICNetwork::get_time() / 1_000_000), // Use current IC time in milliseconds if not provided
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