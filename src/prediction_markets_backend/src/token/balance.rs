// Token balance reconciliation system
//
// This module provides functionality to compare the expected token balances
// (based on markets, bets, and claims) with the actual token balances
// in the canister's accounts.

use candid::{CandidType, Deserialize, Nat};
use serde::Serialize;
use std::cell::RefCell;

use crate::canister::get_current_time;
use crate::claims::claims_storage::CLAIMS;
use crate::claims::claims_types::ClaimStatus;
use crate::market::market::{Market, MarketStatus};
use crate::nat::StorableNat;
use crate::storage::{BETS, MARKETS};
use crate::token::registry::{get_supported_token_identifiers, get_token_info, TokenInfo};
use crate::types::{MarketId, Timestamp, TokenAmount, TokenIdentifier};
use candid::Principal;
use ic_cdk_macros::{query, update};
use icrc_ledger_types::icrc1::account::Account;

/// Summary of token balance reconciliation for a single token
#[derive(CandidType, Debug, Deserialize, Serialize, Clone)]
pub struct TokenBalanceSummary {
    /// Token identifier (canister ID)
    pub token_id: TokenIdentifier,
    /// Token symbol (e.g., "KONG", "ICP")
    pub token_symbol: String,
    /// Actual balance in the canister
    pub actual_balance: TokenAmount,
    /// Expected balance based on markets, bets, and claims
    pub expected_balance: TokenAmount,
    /// Difference between actual and expected (can be positive or negative)
    pub difference: TokenAmount,
    /// True if actual >= expected, false otherwise
    pub is_sufficient: bool,
    /// Detailed breakdown of where tokens are allocated
    pub breakdown: TokenBalanceBreakdown,
    /// Timestamp when this snapshot was taken
    pub timestamp: Timestamp,
}

/// Detailed breakdown of where tokens are allocated
#[derive(CandidType, Debug, Deserialize, Serialize, Clone)]
pub struct TokenBalanceBreakdown {
    /// Total tokens in active markets
    pub active_markets: TokenAmount,
    /// Total tokens in pending activation markets
    pub pending_markets: TokenAmount,
    /// Total tokens in expired markets
    pub expired_markets: TokenAmount,
    /// Total tokens in resolved markets awaiting claims
    pub resolved_markets_unclaimed: TokenAmount,
    /// Total tokens in voided markets awaiting refunds
    pub voided_markets_unclaimed: TokenAmount,
    /// Total tokens in pending claims (both payouts and refunds)
    pub pending_claims: TokenAmount,
    /// Platform fees collected but not yet transferred out
    pub platform_fees: TokenAmount,
    /// Platform fees collected from disputed penalties
    pub disputed_penalty_fees: TokenAmount,
}

/// Summary of all token balances
#[derive(CandidType, Debug, Deserialize, Serialize, Clone)]
pub struct BalanceReconciliationSummary {
    /// Summaries for each token
    pub token_summaries: Vec<TokenBalanceSummary>,
    /// Timestamp when this summary was generated
    pub timestamp: Timestamp,
}

thread_local! {
    /// Store the most recent balance reconciliation summary
    static LATEST_BALANCE_SUMMARY: RefCell<Option<BalanceReconciliationSummary>> = RefCell::new(None);
}

/// Calculate token balance reconciliation for all supported tokens
/// This function is admin-only
#[update]
pub async fn calculate_token_balance_reconciliation() -> BalanceReconciliationSummary {
    // Ensure only admins can call this function
    // Check if caller is an admin
    let caller = ic_cdk::caller();
    if !crate::controllers::admin::is_admin(caller) {
        ic_cdk::trap("Unauthorized: Admin access required");
    }

    let token_ids = get_supported_token_identifiers();
    let mut token_summaries = Vec::new();
    let timestamp = get_current_time();

    for token_id in token_ids {
        let summary = calculate_single_token_balance(&token_id).await;
        token_summaries.push(summary);
    }

    let result = BalanceReconciliationSummary {
        token_summaries,
        timestamp,
    };

    // Store the result for future reference
    LATEST_BALANCE_SUMMARY.with(|cell| {
        *cell.borrow_mut() = Some(result.clone());
    });

    result
}

/// Get the most recent balance reconciliation without recalculating
/// This function is admin-only
#[query]
pub fn get_latest_token_balance_reconciliation() -> Option<BalanceReconciliationSummary> {
    // Ensure only admins can call this function
    let caller = ic_cdk::caller();
    if !crate::controllers::admin::is_admin(caller) {
        ic_cdk::trap("Unauthorized: Admin access required");
    }

    LATEST_BALANCE_SUMMARY.with(|cell| cell.borrow().clone())
}

fn calculate_penalty_fee(token: &TokenInfo) -> StorableNat {
    token.activation_fee.clone()
}

/// Calculate balance reconciliation for a single token
async fn calculate_single_token_balance(token_id: &TokenIdentifier) -> TokenBalanceSummary {
    let token_info = get_token_info(token_id).expect("Token info not found");

    // Get actual token balance from the ledger
    let actual_balance = get_token_balance_from_ledger(token_id).await;

    // Initialize breakdown categories
    let mut active_markets = TokenAmount::from(0u64);
    let mut expired_markets = TokenAmount::from_u64(0u64);
    let mut platform_fees = TokenAmount::from(0u64);
    let mut disputed_penalty_fees = TokenAmount::from(0u64);
    let pending_claims = calculate_pending_claims_total(token_id);

    // Calculate totals from markets
    MARKETS.with(|markets| {
        let markets_ref = markets.borrow();
        for (market_id, market) in markets_ref.iter() {
            if market.token_id != *token_id {
                continue; // Skip markets with different tokens
            }

            match &market.status {
                MarketStatus::Active => {
                    // Sum all bets for this market
                    active_markets += calculate_market_bet_total(&market_id, token_id);
                }
                MarketStatus::ExpiredUnresolved => {
                    // Sum all bets for this market
                    expired_markets += calculate_market_bet_total(&market_id, token_id);
                }
                MarketStatus::PendingActivation => {
                    // Not yet activated => 0 assets
                    continue;
                }
                MarketStatus::Closed(outcomes) => {
                    // Add platform fees (approximate based on bet volume and fee percentage)
                    platform_fees += calculate_platform_fees_for_market(&market, &outcomes, &token_info);
                }
                MarketStatus::Disputed => {
                    ic_cdk::println!("Market {} has unknown status: Disputed ", market.id);
                }
                MarketStatus::Voided => {
                    // There are 2 types of voided markets:
                    // 1. Voided during active/expired
                    // 2. Disputed markets
                    // Penalty fees are taken only for disputed markets
                    if market.resolution_data.is_some() {
                        disputed_penalty_fees += calculate_penalty_fee(&token_info) - token_info.transfer_fee.clone();
                    }
                }
            }
        }
    });

    // Calculate expected total
    // Note: We don't include platform_fees here because they're already accounted for
    // in the active_markets, pending_markets, etc. values.
    // The platform_fees value is calculated separately just for reporting breakdown.
    let expected_balance = StorableNat::from_u64(0u64)
        + active_markets.clone()
        + expired_markets.clone()
        // + platform_fees.clone()  // Don't include platform fees since they already withdrawn
        // + void_penalty_fees.clone() // Don't include void penalty fees since they already withdrawn
        + pending_claims.clone();

    // Calculate difference and determine if balance is sufficient
    let (difference, is_sufficient) = if actual_balance >= expected_balance {
        (actual_balance.clone() - expected_balance.clone(), true)
    } else {
        (expected_balance.clone() - actual_balance.clone(), false)
    };

    let pending_markets = TokenAmount::from_u64(0u64);
    let resolved_markets_unclaimed = TokenAmount::from_u64(0u64);
    let voided_markets_unclaimed = TokenAmount::from_u64(0u64);

    TokenBalanceSummary {
        token_id: token_id.clone(),
        token_symbol: token_info.symbol,
        actual_balance,
        expected_balance,
        difference,
        is_sufficient,
        breakdown: TokenBalanceBreakdown {
            active_markets,
            pending_markets,
            expired_markets,
            resolved_markets_unclaimed,
            voided_markets_unclaimed,
            pending_claims,
            platform_fees,
            disputed_penalty_fees,
        },
        timestamp: get_current_time(),
    }
}

/// Query the token balance from the ledger canister
async fn get_token_balance_from_ledger(token_id: &TokenIdentifier) -> TokenAmount {
    let canister_id = ic_cdk::id();

    // Create account parameter for balance query
    let account = Account {
        owner: canister_id,
        subaccount: None,
    };

    // Make ICRC1 balance call to the token ledger
    let ledger = match Principal::from_text(token_id) {
        Ok(principal) => principal,
        Err(_) => return TokenAmount::from(0u64),
    };

    match ic_cdk::call::<(Account,), (candid::Nat,)>(ledger, "icrc1_balance_of", (account,)).await {
        Ok((balance,)) => {
            // Convert the Nat directly to TokenAmount
            // TokenAmount is u64 internally, so we need to ensure we don't lose precision
            let balance_str = balance.to_string();
            ic_cdk::println!("Retrieved balance for {}: {}", token_id, balance_str);

            // Remove any underscores from the balance string
            let clean_balance_str = balance_str.replace("_", "");

            // Try to convert the clean string representation to u64
            match clean_balance_str.parse::<u64>() {
                Ok(value) => {
                    ic_cdk::println!("Successfully parsed balance to u64: {}", value);
                    TokenAmount::from(value)
                }
                Err(e) => {
                    // Log the parsing error
                    ic_cdk::println!("Warning: Balance parsing error: {} for value: {}", e, balance_str);

                    // For large balances that exceed u64, try to at least return a meaningful value
                    // by taking the lower 64 bits (this is a simplification but better than returning 0)
                    if let Some(stripped) = balance_str.strip_prefix("0x") {
                        // Handle hex format
                        if let Ok(val) = u64::from_str_radix(stripped, 16) {
                            return TokenAmount::from(val);
                        }
                    } else {
                        // For decimal values that are too large, try to get the lower digits
                        if balance_str.len() > 20 {
                            let truncated = &balance_str[balance_str.len() - 19..balance_str.len()];
                            if let Ok(val) = truncated.parse::<u64>() {
                                ic_cdk::println!("Using truncated value: {}", val);
                                return TokenAmount::from(val);
                            }
                        }
                    }

                    // If all else fails, return the maximum possible u64 value
                    // This is better than returning 0 for balance checking
                    ic_cdk::println!("Fallback to maximum u64 value");
                    TokenAmount::from(u64::MAX)
                }
            }
        }
        Err(_) => {
            ic_cdk::println!("Failed to query balance for token {}", token_id);
            TokenAmount::from(0u64)
        }
    }
}

/// Calculate the total amount bet on a market
fn calculate_market_bet_total(market_id: &MarketId, token_id: &TokenIdentifier) -> TokenAmount {
    // First check if the market exists and use its total_pool value if it matches the token
    let mut market_total = TokenAmount::from(0u64);

    MARKETS.with(|markets| {
        let markets_ref = markets.borrow();
        if let Some(market) = markets_ref.get(market_id) {
            if &market.token_id == token_id {
                ic_cdk::println!(
                    "Found market {} with token {} and total_pool {}",
                    market_id,
                    token_id,
                    market.total_pool
                );
                market_total = market.total_pool.clone();
            }
        }
    });

    // If we found a matching market with funds, return its total_pool
    if market_total.to_u64() > 0 {
        return market_total;
    }

    // Fallback to summing individual bets if market not found or token doesn't match
    BETS.with(|bets| {
        let bets_ref = bets.borrow();
        for (bet_key, bet) in bets_ref.iter() {
            if bet_key.market_id == *market_id && bet.token_id == *token_id {
                market_total += bet.amount.clone();
            }
        }
    });

    ic_cdk::println!("Calculated market {} total from bets: {}", market_id, market_total);
    market_total
}

/// Calculate platform fees for a market
pub fn calculate_platform_fees_for_market(market: &Market, winning_outcomes: &Vec<Nat>, token_info: &TokenInfo) -> TokenAmount {
    let to_u64 = |v: &Nat| -> u64 { v.0.to_u64_digits().first().cloned().unwrap_or(0) };
    let outcome_pools = market.outcome_pools.clone();

    let market_total: StorableNat = calculate_market_bet_total(&market.id, &market.token_id);
    let winning_pool_total: StorableNat = winning_outcomes.iter().map(|i| outcome_pools[to_u64(i) as usize].clone()).sum();
    let lost_total: StorableNat = market_total - winning_pool_total;

    let fee_amount = (lost_total * token_info.fee_percentage) / 10000;

    TokenAmount::from(fee_amount)
}

/// Calculate total pending claims for a token
fn calculate_pending_claims_total(token_id: &TokenIdentifier) -> TokenAmount {
    let mut total = TokenAmount::from(0u64);

    CLAIMS.with(|claims| {
        let claims_ref = claims.borrow();
        for (_, claim) in claims_ref.iter() {
            // Check if the claim is still pending (not processed)
            if claim.token_id == *token_id && matches!(claim.status, ClaimStatus::Pending | ClaimStatus::Claiming) {
                total += claim.claimable_amount.clone();
            }
        }
    });

    total
}
