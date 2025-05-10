use candid::Nat;

use crate::stable_token::stable_token::StableToken;
use crate::sol::address::get_sol_address;
use crate::ic::address::Address;
use crate::helpers::nat_helpers::nat_to_u64;
use crate::stable_kong_settings::kong_settings_map;

use crate::sol::rpc::client::SolanaRpcClient;

/// Function to transfer tokens on Solana
pub async fn transfer(
    token: &StableToken,
    to_address: &Address,
    amount: &Nat,
) -> Result<String, String> {
    match token {
        StableToken::SOL(sol_token) => {
            // Get the destination Solana address
            let dest_sol_address = get_sol_address(to_address)?;
            
            // Convert amount to u64
            let amount_u64 = nat_to_u64(amount)
                .ok_or_else(|| format!("SOL: Amount {:?} cannot be converted to u64", amount))?;
            
            // Get settings
            let kong_settings = kong_settings_map::get();
            let rpc_endpoint = kong_settings.sol_rpc_endpoint
                .ok_or_else(|| "Solana RPC URL not configured".to_string())?;
            
            // Get the Kong backend's Solana address
            let backend_address = kong_settings.sol_backend_address
                .ok_or_else(|| "SOL: Kong backend Solana address not configured".to_string())?;
            
            // Initialize Solana RPC client
            let solana_client = crate::sol::init_solana_client(&rpc_endpoint).await?;
            
            // Determine if this is a native SOL transfer or SPL token transfer
            let is_native_sol = sol_token.address == "11111111111111111111111111111111" || 
                                sol_token.symbol.to_uppercase() == "SOL";
            
            if is_native_sol {
                // Native SOL transfer
                transfer_native_sol(&solana_client, &backend_address, &dest_sol_address, amount_u64).await
            } else {
                // SPL token transfer
                transfer_spl_token(&solana_client, &backend_address, &sol_token.address, &dest_sol_address, amount_u64).await
            }
        }
        _ => Err("Transfer not supported for non-Solana tokens".to_string()),
    }
}

/// Function to transfer native SOL
async fn transfer_native_sol(
    _client: &SolanaRpcClient,
    from_address: &str,
    to_address: &str,
    amount: u64,
) -> Result<String, String> {
    // In a real implementation, this would:
    // 1. Create a Solana transaction using client.build_transfer_sol_transaction
    // 2. Sign it with the private key
    // 3. Submit it to the Solana blockchain
    // 4. Return the transaction signature
    
    // Mock implementation
    ic_cdk::println!("Transferring {} SOL from {} to {}", 
        amount as f64 / 1_000_000_000.0, // Convert lamports to SOL
        from_address,
        to_address
    );
    
    // Return a mock transaction signature
    Ok(format!("sol-tx-native-{}-{}", to_address, amount))
}

/// Function to transfer SPL tokens
async fn transfer_spl_token(
    _client: &SolanaRpcClient,
    from_address: &str,
    token_address: &str,
    to_address: &str,
    amount: u64,
) -> Result<String, String> {
    // In a real implementation, this would:
    // 1. Get the associated token accounts for sender and recipient
    // 2. Create an SPL token transfer instruction
    // 3. Create a Solana transaction
    // 4. Sign it with the private key
    // 5. Submit it to the Solana blockchain
    // 6. Return the transaction signature
    
    // Mock implementation
    ic_cdk::println!("Transferring {} SPL tokens (mint: {}) from {} to {}", 
        amount, 
        token_address,
        from_address,
        to_address
    );
    
    // Return a mock transaction signature
    Ok(format!("sol-tx-spl-{}-{}-{}", token_address, to_address, amount))
}