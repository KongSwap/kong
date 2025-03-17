use candid::{Nat, Principal};
use ic_cdk::update;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc2::transfer_from::{TransferFromArgs, TransferFromError};
use num_traits::ToPrimitive;

use super::bet::*;

use crate::market::market::*;
use crate::nat::*;
use crate::stable_memory::*;
use crate::KONG_LEDGER_ID;

// House fee is 0.1% (10 basis points) represented in NAT8
lazy_static::lazy_static! {
    static ref HOUSE_FEE_RATE: StorableNat = StorableNat(candid::Nat::from(100_000u64)); // 0.001 * 10^8 = 100,000
}
const FEES_ENABLED: bool = false;

#[update]
/// Places a bet on a specific market outcome using KONG tokens
async fn place_bet(market_id: MarketId, outcome_index: StorableNat, amount: StorableNat) -> Result<(), BetError> {
    let user = ic_cdk::caller();
    let backend_canister_id = ic_cdk::api::id();
    let kong_ledger = Principal::from_text(KONG_LEDGER_ID).map_err(|e| BetError::TransferError(format!("Invalid ledger ID: {}", e)))?;
    let market_id_clone = market_id.clone();

    // Get market and validate state
    let market = MARKETS.with(|markets| {
        let markets_ref = markets.borrow();
        markets_ref.get(&market_id_clone).ok_or(BetError::MarketNotFound)
    })?;

    // Validate market state and outcome
    if !matches!(market.status, MarketStatus::Open) {
        return Err(BetError::MarketClosed);
    }
    let outcome_idx = outcome_index.to_u64() as usize;
    if outcome_idx >= market.outcomes.len() {
        return Err(BetError::InvalidOutcome);
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
    match ic_cdk::call::<(TransferFromArgs,), (Result<Nat, TransferFromError>,)>(kong_ledger, "icrc2_transfer_from", (args,)).await {
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

    // Calculate house fee (NAT8 arithmetic)
    let (fee_amount, bet_amount) = if FEES_ENABLED {
        let fee = amount.clone() * HOUSE_FEE_RATE.clone() / 100_000_000u64;
        (fee.clone(), amount - fee)
    } else {
        (StorableNat::from(0u64), amount)
    };

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
        };

        bet_store.0.push(new_bet);
        bets.insert(market_id_clone, bet_store);
    });

    Ok(())
}
