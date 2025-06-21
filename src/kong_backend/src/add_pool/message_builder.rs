use num_traits::ToPrimitive;
use serde::{Deserialize, Serialize};

use crate::ic::network::ICNetwork;

use super::add_pool_args::AddPoolArgs;

/// A structure representing the canonical message format for signing pool additions
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct CanonicalAddPoolMessage {
    pub token_0: String,
    pub amount_0: u64,
    pub token_1: String,
    pub amount_1: u64,
    pub lp_fee_bps: u8,
    pub timestamp: u64,
}

impl CanonicalAddPoolMessage {
    /// Create a canonical message from AddPoolArgs
    pub fn from_add_pool_args(args: &AddPoolArgs) -> Self {
        let result = Self {
            token_0: args.token_0.clone(),
            amount_0: args.amount_0.0.to_u64().expect("Amount too large"),
            token_1: args.token_1.clone(),
            amount_1: args.amount_1.0.to_u64().expect("Amount too large"),
            lp_fee_bps: args.lp_fee_bps.unwrap_or(30), // Default 30 bps if not specified
            timestamp: args
                .timestamp
                .unwrap_or_else(|| ICNetwork::get_time() / 1_000_000), // Use current IC time in milliseconds if not provided
        };
        ic_cdk::println!("DEBUG CanonicalAddPoolMessage::from_add_pool_args: created message = {:?}", result);
        result
    }

    /// Serialize to JSON string for signing
    pub fn to_signing_message(&self) -> String {
        serde_json::to_string(self).expect("Failed to serialize message")
    }
}