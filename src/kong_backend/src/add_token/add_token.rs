use candid::{Nat, Principal};
use ic_cdk::update;

use super::add_token_args::AddTokenArgs;
use super::add_token_reply::AddTokenReply;
use super::add_token_reply_helpers::to_add_token_reply;

use crate::chains::chains::{IC_CHAIN, SOL_CHAIN};
use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_token::ic_token::ICToken;
use crate::stable_token::lp_token::LPToken;
use crate::stable_token::solana_token::SolanaToken;
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::token_map;

/// Adds a token to Kong
///
/// # Arguments
///
/// * `args` - The arguments for adding a token.
///
/// # Returns
///
/// * `Ok(String)` - A success message if the token is added successfully.
/// * `Err(String)` - An error message if the operation fails.
///
/// # Errors
///
/// This function returns an error if:
/// - The caller is not a controller.
/// - The token already exists.
#[update(guard = "not_in_maintenance_mode")]
async fn add_token(args: AddTokenArgs) -> Result<AddTokenReply, String> {
    if token_map::get_by_address(&args.token).is_ok() {
        Err(format!("Token {} already exists", args.token))?
    }

    // Support IC tokens (IC.CanisterId) and Solana tokens (SOL.MintAddress)
    match token_map::get_chain(&args.token) {
        Some(chain) if chain == IC_CHAIN => to_add_token_reply(&add_ic_token(&args.token).await?),
        Some(chain) if chain == SOL_CHAIN => to_add_token_reply(&add_solana_token(&args).await?),
        Some(_) | None => Err("Chain not supported")?,
    }
}

/// Adds an Internet Computer (IC) token to the system.
///
/// # Arguments
///
/// * `token` - The address of the token to be added. Must be in the format IC.CanisterId.
///
/// # Returns
///
/// * `Ok(StableToken)` - The newly added token.
/// * `Err(String)` - An error message if the operation fails.
///
/// # Errors
///
/// This function returns an error if:
/// - The address of the token is not found.
/// - The address cannot be converted to a `Principal`.
/// - Creating the `ICToken` fails.
/// - Inserting the token into the token map fails.
/// - Retrieving the inserted token fails.
pub async fn add_ic_token(token: &str) -> Result<StableToken, String> {
    // Retrieves the address of the token.
    let address = token_map::get_address(token).ok_or_else(|| format!("Invalid address {}", token))?;

    // Converts the address to a `Principal`.
    let canister_id = Principal::from_text(address).map_err(|e| format!("Invalid canister id {}: {}", token, e))?;

    let ic_token = StableToken::IC(ICToken::new(&canister_id).await?);
    let token_id = token_map::insert(&ic_token)?;

    // Retrieves the inserted token by its token_id
    token_map::get_by_token_id(token_id).ok_or_else(|| format!("Failed to add token {}", token))
}

/// Adds a Solana token to the system.
///
/// # Arguments
///
/// * `args` - The arguments containing Solana token information.
///
/// # Returns
///
/// * `Ok(StableToken)` - The newly added token.
/// * `Err(String)` - An error message if the operation fails.
pub async fn add_solana_token(args: &AddTokenArgs) -> Result<StableToken, String> {
    // Extract mint address from token string (format: SOL.MintAddress)
    let mint_address = token_map::get_address(&args.token)
        .ok_or_else(|| format!("Invalid address {}", args.token))?;
    
    // Only allow hardcoded SOL and USDC tokens
    // Note: USDC mint address changes based on environment:
    // - Production: Uses mainnet USDC (EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v)
    // - Local/Staging: Uses devnet kUSDC (nnKagNSBhpEe5DAYGzvFhRCoETSTec6FJVCj5wPK155)
    let (name, symbol, decimals, fee, program_id) = match mint_address.as_str() {
        // Native SOL - same across all environments
        "11111111111111111111111111111111" => (
            "Solana".to_string(),
            "SOL".to_string(),
            9u8,
            Nat::from(5000u64), // 0.005 SOL
            "11111111111111111111111111111111".to_string(), // System program
        ),
        // USDC on Solana mainnet (production only)
        #[cfg(feature = "prod")]
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" => (
            "USD Coin".to_string(),
            "USDC".to_string(),
            6u8,
            Nat::from(5000u64), // 0.005 SOL for transfer fee
            "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA".to_string(), // SPL Token program
        ),
        // USDC on Solana devnet (local/staging only)
        #[cfg(any(feature = "local", feature = "staging"))]
        "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU" => (
            "USD Coin".to_string(),
            "USDC".to_string(),
            6u8,
            Nat::from(5000u64), // 0.005 SOL for transfer fee
            "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA".to_string(), // SPL Token program
        ),
        _ => {
            #[cfg(feature = "prod")]
            return Err("Only SOL and mainnet USDC Solana tokens are supported".to_string());
            #[cfg(any(feature = "local", feature = "staging"))]
            return Err("Only SOL and devnet USDC Solana tokens are supported".to_string());
            #[cfg(not(any(feature = "prod", feature = "local", feature = "staging")))]
            return Err("Only SOL and USDC Solana tokens are supported".to_string());
        }
    };
    
    let solana_token = StableToken::Solana(SolanaToken {
        token_id: 0, // Will be set by insert
        name,
        symbol,
        decimals,
        fee,
        mint_address: mint_address.to_string(),
        program_id,
        total_supply: None, // We don't track total supply for now
        is_spl_token: mint_address != "11111111111111111111111111111111", // False for native SOL
    });
    
    let token_id = token_map::insert(&solana_token)?;
    
    // Retrieves the inserted token by its token_id
    token_map::get_by_token_id(token_id).ok_or_else(|| format!("Failed to add Solana token {}", args.token))
}

pub fn add_lp_token(token_0: &StableToken, token_1: &StableToken) -> Result<StableToken, String> {
    let lp_token = StableToken::LP(LPToken::new(token_0, token_1));
    let token_id = token_map::insert(&lp_token)?;

    // Retrieves the inserted token by its token_id
    token_map::get_by_token_id(token_id).ok_or_else(|| "Failed to add LP token".to_string())
}
