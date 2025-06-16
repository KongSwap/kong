use anyhow::Result;
use ic_cdk::api::management_canister::http_request::{http_request_with_closure, CanisterHttpRequestArgument, HttpHeader, HttpMethod};
use serde_json::{json, Value};
use std::sync::atomic::{AtomicU64, Ordering};

use crate::ic::network::ICNetwork;
use crate::solana::error::SolanaError;
use crate::solana::network::SolanaNetwork;

const ALCHEMY_URL_MAINNET: &str = "https://solana-mainnet.g.alchemy.com/v2/6qMktYcIX31yLkrwN403Q4E2BmK2z3W9";
//const QUICK_NODE_URL_DEVNET: &str = "https://prettiest-alpha-isle.solana-devnet.quiknode.pro/ea48d559a80528787ee3da60f5f8309084c01f9f/";
const QUICK_NODE_URL_DEVNET: &str = "https://api.devnet.solana.com/";

// Static atomic counter for request IDs
static REQUEST_ID: AtomicU64 = AtomicU64::new(0);

pub struct SolanaRpcClient {
    pub network: SolanaNetwork,
}

impl SolanaRpcClient {
    pub fn new(network: SolanaNetwork) -> Self {
        Self { network }
    }

    /// Make a JSON-RPC call to the Solana blockchain
    pub async fn make_rpc_call(&self, method: &str, params: Value) -> Result<Value> {
        // loop for 10 times and then timeout
        for _i in 0..10 {
            // Get the RPC URL
            let rpc_url = self.get_rpc_url();

            // Get headers
            let headers = SolanaRpcClient::get_rpc_headers();

            // Increment request ID for each call
            let request_id = REQUEST_ID.fetch_add(1, Ordering::SeqCst);
            // Prepare JSON-RPC request body
            let request_body = json!({
                "jsonrpc": "2.0",
                "id": request_id,
                "method": method,
                "params": params,
            });

            // Create HTTP request
            let request = CanisterHttpRequestArgument {
                url: rpc_url.to_string(),
                method: HttpMethod::POST,
                headers,
                body: Some(request_body.to_string().into_bytes()),
                max_response_bytes: Some(2_000_000), // 2MB - 1,952 bytes (IC limit is 2,000,000)
                transform: None,                     // using http_request_with_closure below so no transform
            };

            // Make the HTTP request via IC management canister, max cycles is 50_000_000_000 (50 billion)
            let response = match http_request_with_closure(request, 50_000_000_000u128, |response| response).await {
                Ok((response,)) => response,
                Err((code, msg)) => {
                    ICNetwork::error_log(&format!("HTTP request failed with code {:?}: {}", code, msg));
                    continue;
                }
            };

            // Parse the JSON response body
            let response_body = match String::from_utf8(response.body) {
                Ok(body) => body,
                Err(e) => {
                    ICNetwork::error_log(&format!("Failed to parse response body: {}", e));
                    continue;
                }
            };
            let json_response: Value = match serde_json::from_str(&response_body) {
                Ok(json) => json,
                Err(e) => {
                    ICNetwork::error_log(&format!("Failed to parse JSON response body: {}", e));
                    continue;
                }
            };
            // Check for RPC errors
            if let Some(error) = json_response.get("error") {
                let message = error.get("message").and_then(|m| m.as_str()).unwrap_or("Unknown RPC error");
                ICNetwork::error_log(&format!("Solana RPC error: {}", message));
                continue;
            }

            // Check for successful response. "result" field is not empty
            if let Some(result) = json_response.get("result") {
                if !result.is_null() {
                    return Ok(json_response); // Successful response
                }
            }

            // retry http call again
        }

        Err(SolanaError::RpcError("RPC operation timed out".to_string()))?
    }

    /// Get the RPC URL for the network
    fn get_rpc_url(&self) -> &'static str {
        match self.network {
            SolanaNetwork::Mainnet => ALCHEMY_URL_MAINNET,
            SolanaNetwork::Devnet => QUICK_NODE_URL_DEVNET,
        }
    }

    /// Get HTTP headers for RPC requests
    fn get_rpc_headers() -> Vec<HttpHeader> {
        vec![HttpHeader {
            name: "Content-Type".to_string(),
            value: "application/json".to_string(),
        }]
    }
}
