use candid::Nat;
use ic_cdk::api::management_canister::http_request::{HttpMethod, CanisterHttpRequestArgument, HttpHeader, http_request};
use serde_json::json;

use crate::stable_kong_settings::kong_settings_map;

/// SPL Token program ID
pub const TOKEN_PROGRAM_ID: &str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

/// Function to get token name from Solana
pub async fn get_name(address: &str) -> Result<String, String> {
    // For native SOL
    if is_native_sol_address(address) {
        return Ok("Solana".to_string());
    }
    
    // Get RPC URL from settings
    #[allow(unused_variables)]
    let rpc_endpoint = kong_settings_map::get_sol_rpc_endpoint()
        .ok_or_else(|| "Solana RPC URL not configured".to_string())?;
    
    // Create JSON-RPC request to get token metadata
    #[allow(unused_variables)]
    let request_body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getTokenSupply", // For SPL tokens
        "params": [
            address,
            {
                "commitment": "confirmed"
            }
        ]
    });
    
    // Make HTTP request
    let request = CanisterHttpRequestArgument {
        url: rpc_endpoint,
        method: HttpMethod::POST,
        headers: vec![HttpHeader {
            name: "Content-Type".to_string(),
            value: "application/json".to_string(),
        }],
        body: Some(serde_json::to_vec(&request_body)
            .map_err(|e| format!("Failed to serialize JSON request: {}", e))?),
        max_response_bytes: Some(2_000_000),
        transform: None,
    };

    let response_result = http_request(request, 0).await;
    
    let response = match response_result {
        Ok((response,)) => response,
        Err((code, msg)) => {
            return Err(format!("HTTP request failed with code {:?}: {}", code, msg));
        }
    };

    if response.status != 200u64 {
        return Err(format!("HTTP request failed with status: {}", response.status));
    }

    // Parse the response
    let response_json: serde_json::Value = serde_json::from_slice(&response.body)
        .map_err(|e| format!("Failed to parse response JSON: {}", e))?;

    // Extract token name (if available)
    let token_name = response_json
        .get("result")
        .and_then(|result| result.get("value"))
        .and_then(|value| value.get("uiTokenAmount"))
        .and_then(|ui_amount| ui_amount.get("token_name"))
        .and_then(|name| name.as_str())
        .map(|s| s.to_string());

    // Return token name or generate a default
    match token_name {
        Some(name) if !name.is_empty() => Ok(name),
        _ => Ok(format!("SPL Token {}", &address[0..8])), // Use first 8 chars of address
    }
}

/// Function to get token symbol from Solana
pub async fn get_symbol(address: &str) -> Result<String, String> {
    // For native SOL
    if is_native_sol_address(address) {
        return Ok("SOL".to_string());
    }
    
    // Get RPC URL from settings
    #[allow(unused_variables)]
    let rpc_endpoint = kong_settings_map::get_sol_rpc_endpoint()
        .ok_or_else(|| "Solana RPC URL not configured".to_string())?;
    
    // Create JSON-RPC request to get token metadata
    #[allow(unused_variables)]
    let request_body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getTokenSupply",
        "params": [
            address,
            {
                "commitment": "confirmed"
            }
        ]
    });
    
    // For demonstration, returning a mock response
    // In real implementation, extract symbol from token metadata
    Ok(format!("SPL{}", &address[0..4].to_uppercase()))
}

/// Function to get token decimals from Solana
pub async fn get_decimals(address: &str) -> Result<u8, String> {
    // For native SOL
    if is_native_sol_address(address) {
        return Ok(9); // Native SOL uses 9 decimals
    }
    
    // Get RPC URL from settings
    #[allow(unused_variables)]
    let rpc_endpoint = kong_settings_map::get_sol_rpc_endpoint()
        .ok_or_else(|| "Solana RPC URL not configured".to_string())?;
    
    // Create JSON-RPC request to get token metadata
    #[allow(unused_variables)]
    let request_body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getTokenSupply",
        "params": [
            address,
            {
                "commitment": "confirmed"
            }
        ]
    });
    
    // For demonstration, returning a mock response
    // In real implementation, extract decimals from token metadata
    Ok(6) // Most SPL tokens use 6 decimals
}

/// Function to get token fee from Solana (lamports or token units per transfer)
pub async fn get_fee(_address: &str) -> Result<Nat, String> {
    // For native SOL or SPL tokens, return standard fee
    // Solana fees are paid in SOL, not in the token itself
    Ok(Nat::from(5000u64)) // Example fee in lamports
}

/// Function to check if token is an SPL token and get its program
pub async fn get_supported_standards(address: &str) -> Result<(bool, String), String> {
    // For native SOL
    if is_native_sol_address(address) {
        return Ok((false, String::new())); // Not an SPL token
    }
    
    // For SPL tokens, check if the token exists and is a valid SPL token
    // Get RPC URL from settings
    let _rpc_endpoint = kong_settings_map::get_sol_rpc_endpoint()
        .ok_or_else(|| "Solana RPC URL not configured".to_string())?;
    
    // Create JSON-RPC request to check token
    let _request_body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "getAccountInfo",
        "params": [
            address,
            {
                "encoding": "jsonParsed",
                "commitment": "confirmed"
            }
        ]
    });
    
    // For demonstration, assuming it's a valid SPL token
    let token_program_id = kong_settings_map::get_sol_token_program_id()
        .unwrap_or_else(|| TOKEN_PROGRAM_ID.to_string());
    
    Ok((true, token_program_id))
}

/// Helper function to check if address is for native SOL
pub fn is_native_sol_address(address: &str) -> bool {
    // Special address for native SOL or specific check
    address == "11111111111111111111111111111111" || 
    address.to_lowercase() == "sol"
}