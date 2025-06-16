use anyhow::Result;
use serde_json::json;

use crate::solana::error::SolanaError;
use crate::solana::network::TOKEN_PROGRAM_ID;

use super::client::SolanaRpcClient;

impl SolanaRpcClient {
    /// Get the SOL balance for an address
    pub async fn get_balance(&self, address: &str) -> Result<u64> {
        let method = "getBalance";
        let params = json!([
            address,
            {
                "commitment": "confirmed"
            }
        ]);
        let response = self.make_rpc_call(method, params).await?;
        if let Some(result) = response.get("result") {
            if let Some(value) = result.get("value") {
                if let Some(balance) = value.as_u64() {
                    return Ok(balance);
                }
            }
        }

        Err(SolanaError::EncodingError(
            "Failed to parse balance response".to_string(),
        ))?
    }

    /// Get the SPL balances for an address
    pub async fn get_token_accounts_by_owner(&self, address: &str) -> Result<String> {
        let method = "getTokenAccountsByOwner";
        let params = json!([
            address,
            {
                "programId": TOKEN_PROGRAM_ID,
            },
            {
                "encoding": "jsonParsed",
                "commitment": "confirmed"
            }
        ]);
        let response = self.make_rpc_call(method, params).await?;
        if let Some(result) = response.get("result") {
            if let Some(values) = result.get("value") {
                if let Some(values_array) = values.as_array() {
                    for value in values_array {
                        if let Some(account) = value.get("account") {
                            if let Some(data) = account.get("data") {
                                if let Some(parsed) = data.get("parsed") {
                                    if let Some(parsed_obj) = parsed.as_object() {
                                        if let Some(r#type) = parsed_obj.get("type") {
                                            if r#type.as_str() == Some("account") {
                                                // for SPL token account type == account
                                                if let Some(info) = parsed_obj.get("info") {
                                                    return Ok(info.to_string());
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Err(SolanaError::EncodingError(
            "Failed to parse token accounts response".to_string(),
        ))?
    }
}
