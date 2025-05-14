//! # Bet Placement Module
//! 
//! This module implements the core betting functionality for the Kong Swap prediction markets
//! platform. It handles token transfers, market state updates, and bet recording with support
//! for multiple token types and time-weighted distributions.
//! 
//! ## Key Features
//! 
//! - **Multi-token Support**: Users can place bets using various token types (KONG, ICP, etc.)
//! - **Time-weighted Rewards**: Bet timestamps are recorded for time-weighted distributions
//! - **Market Activation**: First bet by creator activates pending markets
//! - **Dynamic Fee Calculation**: Token-specific platform fees
//! 
//! The bet placement process includes token transfer validation, market state verification,
//! and record-keeping for later payout calculations. For time-weighted markets, the system
//! records the timestamp of each bet to determine reward weights during market resolution.

use candid::{Nat, Principal};
use ic_cdk::update;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc2::transfer_from::{TransferFromArgs, TransferFromError};
use num_traits::ToPrimitive;

use super::bet::*;

use crate::market::market::*;
use crate::nat::StorableNat;
use crate::stable_memory::*;
use crate::types::{MarketId, TokenAmount, OutcomeIndex, min_activation_bet, TokenIdentifier, calculate_platform_fee};
use crate::controllers::admin::is_admin;
use crate::token::registry::{get_token_info, is_supported_token};

// House fee constant and configuration
lazy_static::lazy_static! {
    /// House fee is 0.1% (10 basis points) represented in basis points
    /// 
    /// This fee rate is applied to bet amounts when fees are enabled in the system.
    /// For KONG tokens, fees are burned. For other tokens, fees are collected in a
    /// central treasury account controlled by the platform administrators.
    static ref HOUSE_FEE_RATE: TokenAmount = TokenAmount::from(100_000u64); // 0.001 * 10^8 = 100,000
}

/// Global switch to enable/disable platform fees
/// 
/// When set to false, no fees are collected on any bets. This can be used
/// during promotional periods or for testing environments.
const FEES_ENABLED: bool = false;

/// Places a bet on a specific market outcome using tokens
/// 
/// This function allows users to place bets on prediction markets using ICRC-2 compliant tokens.
/// The bet amount is transferred from the user to the canister, and the market state is updated
/// to reflect the new bet. For time-weighted markets, the bet timestamp is recorded to later
/// determine reward weights based on betting time.
/// 
/// # Prerequisites
/// - User must have approved the prediction markets canister to spend their tokens using
///   the `icrc2_approve` method on the token ledger canister
/// - Market must be in Active state (or Pending if the caller is the creator)
/// - Token type must match the market's token type
/// 
/// # Parameters
/// * `market_id` - ID of the market to bet on
/// * `outcome_index` - Index of the outcome being bet on
/// * `amount` - Amount of tokens to bet (raw token units including decimals)
/// * `token_id` - Optional token identifier; if omitted, uses the market's token
/// 
/// # Returns
/// * `Result<(), BetError>` - Success or failure with detailed error reason
/// 
/// # State Changes
/// - Transfers tokens from user to canister
/// - Updates market pools and percentages
/// - Records the bet with timestamp for time-weighted calculations
/// - Activates market if this is the activation bet from creator
#[update]
async fn place_bet(
    market_id: MarketId, 
    outcome_index: OutcomeIndex, 
    amount: TokenAmount,
    token_id: Option<TokenIdentifier>
) -> Result<(), BetError> {
    let user = ic_cdk::caller();
    let backend_canister_id = ic_cdk::api::id();
    let market_id_clone = market_id.clone();
    
    // Get market and validate state
    let market = MARKETS.with(|markets| {
        let markets_ref = markets.borrow();
        markets_ref.get(&market_id_clone).ok_or(BetError::MarketNotFound)
    })?;
    
    // Determine which token to use
    // If token_id is provided, use that. Otherwise, use the market's token_id
    let token_id = token_id.unwrap_or_else(|| market.token_id.clone());
    
    // Validate the token is supported
    if !is_supported_token(&token_id) {
        return Err(BetError::TransferError(format!("Unsupported token: {}", token_id)));
    }
    
    // Get token info for the transfer
    let token_info = get_token_info(&token_id)
        .ok_or_else(|| BetError::TransferError(format!("Token info not found for: {}", token_id)))?;
    
    // Validate token matches market's token
    if token_id != market.token_id {
        return Err(BetError::TransferError(
            format!("Token mismatch: Bet uses {}, but market uses {}", token_id, market.token_id)
        ));
    }
    
    // Get token ledger canister ID
    let token_ledger = Principal::from_text(&token_id)
        .map_err(|e| BetError::TransferError(format!("Invalid token ledger ID: {}", e)))?;

    // Outcome validation already handled above

    // Validate market state and outcome
    let outcome_idx = outcome_index.to_u64() as usize;
    if outcome_idx >= market.outcomes.len() {
        return Err(BetError::InvalidOutcome);
    }
    
    // Handle market status
    match market.status {
        MarketStatus::Active => {
            // Market is active, betting is allowed for everyone
        },
        MarketStatus::PendingActivation => {
            // Only the creator can place an activation bet on a pending activation market
            if user != market.creator {
                return Err(BetError::NotMarketCreator);
            }
            
            // Ensure the bet meets the minimum activation threshold for this token
            let min_activation = min_activation_bet(&token_id);
            if amount < min_activation {
                return Err(BetError::InsufficientActivationBet);
            }
            
            // Admins don't need to meet the minimum bet requirement
            // This is a fallback, but shouldn't be needed as admin-created markets start as Active
            if !is_admin(user) {
                // For regular users, confirm the activation amount
                ic_cdk::println!("Activating market {} with bet of {} {} tokens", 
                              market_id.to_u64(), 
                              amount.to_u64() / 10u64.pow(token_info.decimals as u32),
                              token_info.symbol);
            }
        },
        MarketStatus::Closed(_) => return Err(BetError::MarketClosed),
        MarketStatus::ExpiredUnresolved => return Err(BetError::MarketClosed),
        MarketStatus::Disputed => return Err(BetError::InvalidMarketStatus),
        MarketStatus::Voided => return Err(BetError::InvalidMarketStatus),
    }

    // Transfer tokens from user to the canister using icrc2_transfer_from
    // Create the transfer_from arguments
    let args = TransferFromArgs {
        spender_subaccount: None,
        from: Account {
            owner: user,
            subaccount: None,
        },
        to: Account {
            owner: backend_canister_id,
            subaccount: None,
        },
        amount: amount.inner().clone(),
        fee: None,
        memo: None,
        created_at_time: None,
    };
    match ic_cdk::call::<(TransferFromArgs,), (Result<Nat, TransferFromError>,)>(token_ledger, "icrc2_transfer_from", (args,)).await {
        Ok((Ok(_block_index),)) => Ok(()),
        Ok((Err(e),)) => Err(BetError::TransferError(format!(
            "Transfer failed: {:?}. Make sure you have approved the prediction market canister to spend your tokens using icrc2_approve",
            e
        ))),
        Err((code, msg)) => Err(BetError::TransferError(format!("Transfer failed: {} (code: {:?})", msg, code))),
    }?;

    // Re-read the market after the transfer to get latest state
    let mut market = MARKETS.with(|markets| {
        let markets_ref = markets.borrow();
        markets_ref.get(&market_id_clone).ok_or(BetError::MarketNotFound)
    })?;

    // Calculate token-specific platform fee
    let fee_amount = if FEES_ENABLED {
        calculate_platform_fee(&amount, &token_id)
    } else {
        StorableNat::from(0u64)
    };
    
    let bet_amount = amount.clone() - fee_amount.clone();

    // Update fee balance
    FEE_BALANCE.with(|fees| {
        let mut fees = fees.borrow_mut();
        let current_fees = fees.get(&backend_canister_id).unwrap_or(0);
        fees.insert(
            backend_canister_id,
            (StorableNat::from(current_fees) + fee_amount).0 .0.to_u64().unwrap_or(0),
        );
    });

    // Update market pool with bet amount (excluding fee)
    // This updates the total tokens in the market and recalculates outcome percentages
    // These percentages are used for UI display and odd calculations
    market.total_pool += bet_amount.clone();
    market.outcome_pools[outcome_idx] = market.outcome_pools[outcome_idx].clone() + bet_amount.clone();
    
    // Recalculate outcome percentages after adding the new bet
    // Formula: outcome_percentage[i] = outcome_pool[i] / total_pool
    market.outcome_percentages = market
        .outcome_pools
        .iter()
        .map(|pool| {
            if !market.total_pool.is_zero() {
                (pool.to_u64() as f64) / (market.total_pool.to_u64() as f64)
            } else {
                0.0
            }
        })
        .collect();

    market.bet_counts[outcome_idx] = market.bet_counts[outcome_idx].clone() + 1u64;
    let total_bets: StorableNat = market.bet_counts.iter().cloned().sum();
    market.bet_count_percentages = market
        .bet_counts
        .iter()
        .map(|count| {
            if !total_bets.is_zero() {
                count.to_f64() / total_bets.to_f64()
            } else {
                0.0
            }
        })
        .collect();

    // Market Activation Logic
    // If this is an activation bet from the creator, update the market status from PendingActivation to Active
    // User-created markets start as PendingActivation and require this activation bet to become available
    // Admin-created markets start as Active and don't require this step
    if matches!(market.status, MarketStatus::PendingActivation) && user == market.creator {
        market.status = MarketStatus::Active;
        ic_cdk::println!("Market {} activated by creator bet of {} {}", 
                      market_id.to_u64(),
                      amount.to_u64() / 10u64.pow(token_info.decimals as u32),
                      token_info.symbol);
    }
    
    // Update market in storage
    MARKETS.with(|markets| {
        let mut markets_ref = markets.borrow_mut();
        markets_ref.insert(market_id_clone.clone(), market);
    });

    // Record the bet in stable memory
    // This information is crucial for several purposes:
    // 1. Computing rewards during market resolution
    // 2. Calculating time-weighted distributions (using the timestamp)
    // 3. Generating user bet history and statistics
    BETS.with(|bets| {
        let mut bets = bets.borrow_mut();
        let mut bet_store = bets.get(&market_id_clone).unwrap_or_default();

        let new_bet = Bet {
            user,                               // User who placed the bet
            market_id: market_id_clone.clone(), // Market being bet on
            amount: bet_amount,                // Actual bet amount (excluding platform fee)
            outcome_index,                     // Selected outcome
            timestamp: StorableNat::from(ic_cdk::api::time()), // Current time for time-weighting
            token_id: token_id.clone(),        // Token type used for the bet
        };

        // Add the bet to the market's bet store
        bet_store.0.push(new_bet);
        bets.insert(market_id_clone, bet_store);
        
        // For time-weighted markets, the timestamp is particularly important
        // as it determines the weight factor during payout calculations
        // Earlier bets receive higher weights using the formula: w(t) = α^(t/T)
    });

    Ok(())
}
