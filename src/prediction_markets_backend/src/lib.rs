//! Prediction Markets Smart Contract for Internet Computer
//! This module implements a decentralized prediction markets system where users can:
//! - Create markets with multiple possible outcomes
//! - Place bets on outcomes
//! - Resolve markets through various methods (admin, oracle, or decentralized)
//! - Automatically distribute winnings to successful bettors

use candid::Principal;
use ic_cdk_macros::{init, pre_upgrade, post_upgrade};

use crate::bet::bet::*;
use crate::canister::*;
use crate::category::market_category::*;
use crate::delegation::*;
use crate::market::create_market::*;
use crate::market::market::*;
use crate::market::get_all_markets::GetAllMarketsArgs;
use crate::market::get_all_markets::GetAllMarketsResult;
use crate::market::get_market_by_status::GetMarketsByStatusArgs;
use crate::market::get_market_by_status::GetMarketsByStatusResult;
use crate::market::estimate_return_types::{EstimatedReturn, TimeWeightPoint, BetPayoutRecord};
// Standard types
use crate::resolution::resolution::*;
use crate::user::user::*;
use crate::market::get_stats::*;
use crate::token::registry::TokenInfo;
use crate::transaction_recovery::FailedTransaction;
use icrc_ledger_types::icrc21::requests::ConsentMessageRequest;
use icrc_ledger_types::icrc21::responses::ConsentInfo; 
use icrc_ledger_types::icrc21::errors::ErrorInfo;

pub mod bet;
pub mod canister;
pub mod category;
pub mod constants;
pub mod controllers;
pub mod delegation;
pub mod market;
pub mod nat;
pub mod resolution;
pub mod stable_memory;
pub mod token;
pub mod transaction_recovery;
pub mod types;
pub mod user;
pub mod utils;

// Re-export common types for convenience
pub use types::{MarketId, Timestamp, TokenAmount, OutcomeIndex, PoolAmount, BetCount, TokenIdentifier};

// Constants
// const KONG_LEDGER_ID: &str = "o7oak-iyaaa-aaaaq-aadzq-cai"; ///Production KONG canister
const KONG_LEDGER_ID: &str = "umunu-kh777-77774-qaaca-cai"; ///For Local testing

// We don't need import the registry functions here
// since we're not using them directly in the post_upgrade function

#[init]
fn init() {
    MARKET_ID.store(max_market_id(), std::sync::atomic::Ordering::SeqCst);
}

/// Called before canister upgrade to preserve state
#[pre_upgrade]
fn pre_upgrade() {
    //
}

/// Called after canister upgrade to restore state
#[post_upgrade]
fn post_upgrade() {
    stable_memory::restore();
    ic_cdk::println!("Successfully restored stable memory in post_upgrade");
    
    // No need to run migrations for existing markets as requested by the user
    // New markets will automatically use the new token system, while existing ones remain unchanged
}

// Export Candid interface
ic_cdk::export_candid!();
