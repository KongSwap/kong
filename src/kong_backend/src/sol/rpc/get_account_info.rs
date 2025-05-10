use anyhow::Result;
use serde_json::json;

use crate::sol::error::SolanaError;

use super::client::SolanaRpcClient;

impl SolanaRpcClient {
    /// Get account information for an address
    pub async fn get_account_info(&self, address: &str) -> Result<String> {
        let method = "getAccountInfo";
        let params = json!([
            address,
            {
                "encoding": "jsonParsed",
                "commitment": "confirmed"
            }
        ]);
        let response = self.make_rpc_call(method, params).await?;
        if let Some(result) = response.get("result") {
            if let Some(value) = result.get("value") {
                return Ok(value.to_string());
            }
        }

        Err(SolanaError::EncodingError(
            "Failed to parse account info response".to_string(),
        ))?
    }
}