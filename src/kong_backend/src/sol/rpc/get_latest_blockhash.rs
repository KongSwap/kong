use anyhow::Result;
use candid::{CandidType, Deserialize};
use serde::Serialize;
use serde_json::json;

use crate::sol::error::SolanaError;

use super::client::SolanaRpcClient;

/// Blockhash response structure
#[derive(Debug, CandidType, Serialize, Deserialize, Clone)]
pub struct BlockhashResponse {
    pub blockhash: String,
    #[serde(rename = "lastValidBlockHeight")]
    pub last_valid_block_height: u64,
    #[serde(default = "current_time")]
    pub timestamp: u64,
}

// Helper function to provide the current time as default
fn current_time() -> u64 {
    crate::ic::get_time::get_time() as u64
}

impl SolanaRpcClient {
    /// Get the latest blockhash
    pub async fn get_latest_blockhash(&self) -> Result<BlockhashResponse> {
        let method = "getLatestBlockhash";
        let params = json!([{"commitment": "confirmed"}]);
        let response = self.make_rpc_call(method, params).await?;
        if let Some(result) = response.get("result") {
            if let Some(value) = result.get("value") {
                if let Ok(blockhash) = serde_json::from_value::<BlockhashResponse>(value.clone()) {
                    // blockhash.timestamp is set automatically via the default attribute
                    return Ok(blockhash);
                }
            }
        }

        Err(SolanaError::EncodingError(
            "Failed to parse blockhash response".to_string(),
        ))?
    }
}