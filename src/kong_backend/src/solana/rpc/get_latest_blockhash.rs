use anyhow::Result;
use candid::{CandidType, Deserialize};
use serde::Serialize;
use serde_json::json;

use crate::ic::network::ICNetwork;
use crate::solana::error::SolanaError;

use super::client::SolanaRpcClient;
use super::helpers::extract_rpc_result;

/// Blockhash response structure
#[derive(Debug, CandidType, Serialize, Deserialize, Clone)]
pub struct BlockhashResponse {
    pub blockhash: String,

    #[serde(rename = "lastValidBlockHeight")]
    pub last_valid_block_height: u64,

    #[serde(default = "ICNetwork::get_time")]
    pub timestamp: u64,
}

impl SolanaRpcClient {
    /// Get the latest blockhash
    pub async fn get_latest_blockhash(&self) -> Result<BlockhashResponse> {
        let method = "getLatestBlockhash";
        let params = json!([{"commitment": "confirmed"}]);
        let response = self.make_rpc_call(method, params).await?;

        // Use helper to extract nested value
        let value = extract_rpc_result(&response, &["result", "value"])?;

        // Deserialize into BlockhashResponse
        Ok(serde_json::from_value::<BlockhashResponse>(value.clone())
            .map_err(|e| SolanaError::EncodingError(format!("Failed to parse blockhash response: {}", e)))?)
    }
}
