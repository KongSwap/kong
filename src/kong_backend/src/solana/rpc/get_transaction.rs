use anyhow::Result;
use serde_json::{json, Value};

use crate::solana::error::SolanaError;

use super::client::SolanaRpcClient;

impl SolanaRpcClient {
    /// Generic transaction parser
    async fn get_transaction_by_type(&self, tx_signature: &str, transaction_type: &str) -> Result<String> {
        let method = "getTransaction";
        let params = json!([
            tx_signature,
            {
                "encoding": "jsonParsed",
                "maxSupportedTransactionVersion": 0,
            }
        ]);
        
        let response = self.make_rpc_call(method, params).await?;
        
        // Navigate through the JSON structure
        let instructions = response
            .get("result")
            .and_then(|r| r.get("transaction"))
            .and_then(|t| t.get("message"))
            .and_then(|m| m.get("instructions"))
            .and_then(|i| i.as_array())
            .ok_or_else(|| SolanaError::EncodingError(
                "Invalid transaction structure".to_string()
            ))?;
        
        // Find instruction with matching type
        for instruction in instructions {
            if let Some(info) = instruction
                .get("parsed")
                .and_then(|p| p.as_object())
                .filter(|parsed| parsed.get("type").and_then(Value::as_str) == Some(transaction_type))
                .and_then(|parsed| parsed.get("info"))
            {
                return Ok(info.to_string());
            }
        }
        
        Err(SolanaError::EncodingError(
            format!("No '{}' instruction found in transaction", transaction_type)
        ))?
    }
    
    /// Get SOL transaction
    pub async fn get_sol_transaction(&self, tx_signature: &str) -> Result<String> {
        self.get_transaction_by_type(tx_signature, "transfer").await
    }

    /// Get SPL token transaction
    pub async fn get_spl_transaction(&self, tx_signature: &str) -> Result<String> {
        self.get_transaction_by_type(tx_signature, "transferChecked").await
    }
}
