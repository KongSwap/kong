use serde_json::Value;
use crate::solana::error::SolanaError;

/// Generic RPC response parser that navigates through nested JSON paths
pub fn extract_rpc_result<'a>(response: &'a Value, path: &[&str]) -> Result<&'a Value, SolanaError> {
    let mut current = response;
    
    for &segment in path {
        current = current.get(segment).ok_or_else(|| {
            SolanaError::EncodingError(format!(
                "Failed to parse RPC response: missing field '{}'",
                segment
            ))
        })?;
    }
    
    Ok(current)
}

/// Extract a string value from RPC response
pub fn extract_rpc_string(response: &Value, path: &[&str]) -> Result<String, SolanaError> {
    let value = extract_rpc_result(response, path)?;
    
    value.as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| SolanaError::EncodingError(
            format!("Expected string at path: {:?}", path)
        ))
}

/// Extract a u64 value from RPC response
pub fn extract_rpc_u64(response: &Value, path: &[&str]) -> Result<u64, SolanaError> {
    let value = extract_rpc_result(response, path)?;
    
    value.as_u64()
        .ok_or_else(|| SolanaError::EncodingError(
            format!("Expected u64 at path: {:?}", path)
        ))
}

/// Extract an array from RPC response
pub fn extract_rpc_array<'a>(response: &'a Value, path: &[&str]) -> Result<&'a Vec<Value>, SolanaError> {
    let value = extract_rpc_result(response, path)?;
    
    value.as_array()
        .ok_or_else(|| SolanaError::EncodingError(
            format!("Expected array at path: {:?}", path)
        ))
}