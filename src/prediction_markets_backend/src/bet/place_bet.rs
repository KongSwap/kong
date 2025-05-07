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

// House fee is 0.1% (10 basis points) represented in basis points
lazy_static::lazy_static! {
    static ref HOUSE_FEE_RATE: TokenAmount = TokenAmount::from(100_000u64); // 0.001 * 10^8 = 100,000
}
const FEES_ENABLED: bool = false;

#[update]
/// Places a bet on a specific market outcome using tokens
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
        MarketStatus::Pending => {
            // Only the creator can place an activation bet on a pending market
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
    market.total_pool += bet_amount.clone();
    market.outcome_pools[outcome_idx] = market.outcome_pools[outcome_idx].clone() + bet_amount.clone();
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

    // If this is an activation bet from the creator, update the market status
    if matches!(market.status, MarketStatus::Pending) && user == market.creator {
        market.status = MarketStatus::Active;
    }
    
    // Update market in storage
    MARKETS.with(|markets| {
        let mut markets_ref = markets.borrow_mut();
        markets_ref.insert(market_id_clone.clone(), market);
    });

    // Record the bet
    BETS.with(|bets| {
        let mut bets = bets.borrow_mut();
        let mut bet_store = bets.get(&market_id_clone).unwrap_or_default();

        let new_bet = Bet {
            user,
            market_id: market_id_clone.clone(),
            amount: bet_amount, // Store the actual bet amount without fee
            outcome_index,
            timestamp: StorableNat::from(ic_cdk::api::time()),
            token_id: token_id.clone(),
        };

        bet_store.0.push(new_bet);
        bets.insert(market_id_clone, bet_store);
    });

    Ok(())
}
