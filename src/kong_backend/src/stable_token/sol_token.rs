use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

use crate::chains::chains::SOL_CHAIN;


/// SOLToken represents a Solana token on the Kong DEX
#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct SOLToken {
    /// Unique identifier for this token in the token registry
    pub token_id: u32,
    
    /// Token name (e.g., "Solana", "USD Coin")
    pub name: String,
    
    /// Token symbol (e.g., "SOL", "USDC")
    pub symbol: String,
    
    /// Solana address (either a public key for native SOL or mint address for SPL tokens)
    pub address: String,
    
    /// Token decimals (e.g., 9 for SOL, 6 for USDC)
    pub decimals: u8,
    
    /// Transaction fee in smallest units
    pub fee: Nat,
    
    /// Whether this is an SPL token (similar to ICRC1)
    pub spl: bool,
    
    /// Whether this token has been removed/disabled
    pub is_removed: bool,
    
    /// Optional URL to token logo
    pub logo_url: Option<String>,
    
    /// Optional URL to token website
    pub website_url: Option<String>,
}

impl SOLToken {
    /// Create a new SOLToken with the given parameters
    pub fn new(
        token_id: u32,
        name: String,
        symbol: String,
        address: String,
        decimals: u8,
        fee: Nat,
        spl: bool,
    ) -> Self {
        Self {
            token_id,
            name,
            symbol,
            address,
            decimals,
            fee,
            spl,
            is_removed: false,
            logo_url: None,
            website_url: None,
        }
    }

    /// Attempt to create a new SOLToken by fetching metadata from the blockchain
    pub async fn from_address(address: &str, token_id: u32) -> Result<Self, String> {
        // Initialize Solana RPC client with default endpoint
        let _rpc_client = match crate::sol::init_solana_client("https://api.mainnet-beta.solana.com").await {
            Ok(client) => client,
            Err(e) => return Err(format!("Failed to initialize Solana RPC client: {}", e)),
        };

        // Check if this is for native SOL
        if address.to_uppercase() == "SOL" || address == "11111111111111111111111111111111" {
            return Ok(Self {
                token_id,
                name: "Solana".to_string(),
                symbol: "SOL".to_string(),
                address: "11111111111111111111111111111111".to_string(), // System program address
                decimals: 9,
                fee: Nat::from(5000u64), // Fee in lamports
                spl: false,
                is_removed: false,
                logo_url: None,
                website_url: None,
            });
        }

        // For SPL tokens, fetch metadata from the blockchain
        // In a real implementation, we would use the Solana RPC to get token metadata
        // For now, create a basic SPL token with the given address
        Ok(Self {
            token_id,
            name: format!("SPL Token {}", &address[0..8]),
            symbol: format!("SPL{}", &address[0..4].to_uppercase()),
            address: address.to_string(),
            decimals: 6, // Default for many SPL tokens
            fee: Nat::from(10000u64), // Higher fee for SPL tokens
            spl: true,
            is_removed: false,
            logo_url: None,
            website_url: None,
        })
    }

    /// Get the chain identifier for this token
    pub fn chain(&self) -> String {
        SOL_CHAIN.to_string()
    }
}