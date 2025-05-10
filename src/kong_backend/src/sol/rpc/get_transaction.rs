use anyhow::Result;
use serde_json::json;

use crate::sol::error::SolanaError;

use super::client::SolanaRpcClient;

impl SolanaRpcClient {
    /// Get SOL transaction
    pub async fn get_sol_transaction(&self, tx_signature: &str) -> Result<String> {
        let method = "getTransaction";
        let params = json!([
            tx_signature,
            {
                "encoding": "jsonParsed",
                "maxSupportedTransactionVersion": 0,
            }
        ]);
        let response = self.make_rpc_call(method, params).await?;
        if let Some(result) = response.get("result") {
            if let Some(transaction) = result.get("transaction") {
                if let Some(message) = transaction.get("message") {
                    if let Some(instructions) = message.get("instructions") {
                        if let Some(instructions_array) = instructions.as_array() {
                            for instruction in instructions_array {
                                if let Some(parsed) = instruction.get("parsed") {
                                    if let Some(parsed) = parsed.as_object() {
                                        if let Some(r#type) = parsed.get("type") {
                                            if r#type.as_str() == Some("transfer") {
                                                // for SOL transfer type == transfer
                                                if let Some(info) = parsed.get("info") {
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
            "Failed to parse getTransaction response".to_string(),
        ))?
    }

    // Get SPL token transaction
    pub async fn get_spl_transaction(&self, tx_signature: &str) -> Result<String> {
        let method = "getTransaction";
        let params = json!([
            tx_signature,
            {
                "encoding": "jsonParsed",
                "maxSupportedTransactionVersion": 0,
            }
        ]);
        let response = self.make_rpc_call(method, params).await?;
        if let Some(result) = response.get("result") {
            if let Some(transaction) = result.get("transaction") {
                if let Some(message) = transaction.get("message") {
                    if let Some(instructions) = message.get("instructions") {
                        if let Some(instructions_array) = instructions.as_array() {
                            for instruction in instructions_array {
                                if let Some(parsed) = instruction.get("parsed") {
                                    if let Some(parsed) = parsed.as_object() {
                                        if let Some(r#type) = parsed.get("type") {
                                            if r#type.as_str() == Some("transferChecked") {
                                                // for SPL-token transfer type == transferChecked
                                                if let Some(info) = parsed.get("info") {
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
            "Failed to parse getTransaction response".to_string(),
        ))?
    }
}