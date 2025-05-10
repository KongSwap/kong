use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::sol::error::SolanaError;
use crate::sol::rpc::client::SolanaRpcClient;
use crate::sol::sdk::pubkey::SolanaPubkey;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionResponse {
    pub signature: String,
    pub slot: u64,
    pub error: Option<String>,
    pub block_time: Option<u64>,
}

impl SolanaRpcClient {
    /// Submit a signed transaction to the Solana network
    pub async fn submit_transaction(&self, serialized_tx: &str) -> Result<String, SolanaError> {
        let rpc_params = json!([
            serialized_tx,
            {
                "encoding": "base64",
                "preflightCommitment": "confirmed"
            }
        ]);
        let response = self.make_rpc_call("sendTransaction", rpc_params)
            .await
            .map_err(|e| SolanaError::RpcError(e.to_string()))?;

        // Parse the response
        match response.get("result") {
            Some(result) if result.is_string() => {
                // Transaction submitted successfully
                Ok(result.as_str().unwrap_or_default().to_string())
            }
            _ => {
                // Check for error
                if let Some(error) = response.get("error") {
                    let error_message = error.get("message")
                        .and_then(|msg| msg.as_str())
                        .unwrap_or("Unknown error");
                    
                    Err(SolanaError::TransactionError(error_message.to_string()))
                } else {
                    Err(SolanaError::InvalidResponse("Invalid response format".to_string()))
                }
            }
        }
    }

    /// Get recent blockhash
    pub async fn get_recent_blockhash(&self) -> Result<String, SolanaError> {
        let rpc_params = json!([
            {
                "commitment": "confirmed"
            }
        ]);
        let response = self.make_rpc_call("getLatestBlockhash", rpc_params)
            .await
            .map_err(|e| SolanaError::RpcError(e.to_string()))?;

        // Parse the response
        match response.get("result") {
            Some(result) => {
                let blockhash = result.get("value")
                    .and_then(|value| value.get("blockhash"))
                    .and_then(|hash| hash.as_str())
                    .ok_or_else(|| SolanaError::InvalidResponse("Blockhash not found in response".to_string()))?;
                
                Ok(blockhash.to_string())
            }
            _ => {
                // Check for error
                if let Some(error) = response.get("error") {
                    let error_message = error.get("message")
                        .and_then(|msg| msg.as_str())
                        .unwrap_or("Unknown error");
                    
                    Err(SolanaError::RpcError(error_message.to_string()))
                } else {
                    Err(SolanaError::InvalidResponse("Invalid response format".to_string()))
                }
            }
        }
    }

    /// Build a transfer SOL transaction (simplified mock)
    pub fn build_transfer_sol_transaction(
        &self,
        from_pubkey: &SolanaPubkey,
        to_pubkey: &SolanaPubkey,
        lamports: u64,
        _memo: Option<&str>,
    ) -> String {
        // This is a mock implementation that would normally:
        // 1. Create system transfer instruction
        // 2. Add memo instruction if provided
        // 3. Create and sign transaction
        // 4. Serialize transaction to base64
        
        // For now, return a mock serialized transaction
        format!("mockTransactionBase64FromTo{}{}{}", from_pubkey, to_pubkey, lamports)
    }

    /// Build a transfer SPL token transaction (simplified mock)
    pub fn build_transfer_spl_transaction(
        &self,
        from_token_account: &SolanaPubkey,
        to_token_account: &SolanaPubkey,
        mint: &SolanaPubkey,
        authority: &SolanaPubkey,
        amount: u64,
        _memo: Option<&str>,
    ) -> String {
        // This is a mock implementation that would normally:
        // 1. Create token transfer instruction
        // 2. Add memo instruction if provided
        // 3. Create and sign transaction
        // 4. Serialize transaction to base64
        
        // For now, return a mock serialized transaction
        format!("mockSplTransactionBase64FromTo{}{}{}{}{}", 
            from_token_account, to_token_account, mint, authority, amount)
    }
}