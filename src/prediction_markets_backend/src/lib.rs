//! # Kong Swap Prediction Markets Smart Contract
//!
//! This canister implements a decentralized prediction markets platform for the Internet Computer
//! where users can create markets, place bets, and earn rewards for accurate predictions.
//!
//! ## Core Features
//!
//! - **Multi-token Support**: Markets can be created with different token types (KONG, ICP, etc.)
//! - **Market Creation**: Both users and admins can create markets with multiple possible outcomes
//! - **Time-weighted Payouts**: Early bettors can receive higher rewards through exponential time weighting
//! - **Dual Approval Resolution**: User-created markets require agreement between creator and admin
//! - **Transaction Recovery**: Robust handling of failed transactions with retry mechanisms
//! - **Multi-select Markets**: Support for markets with multiple winning outcomes
//!
//! ## Resolution Flows
//!
//! 1. **Admin-Created Markets**: Can be directly resolved by any admin without requiring dual approval
//! 2. **User-Created Markets**: Require dual approval between the creator and an admin, with special
//!    handling for resolution disagreements
//!
//! ## System Architecture
//!
//! The codebase is organized into modules for market management, bet handling, resolution processes,
//! token operations, and user management. It uses the Internet Computer's stable memory system for
//! persistence across canister upgrades.

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
const KONG_LEDGER_ID: &str = "umunu-kh777-77774-qaaca-cai"; /// Canister ID for KONG token ledger (local testing environment)

// We don't need import the registry functions here
// since we're not using them directly in the post_upgrade function

/// Canister initialization function
/// 
/// Called when the canister is deployed for the first time.
/// Sets up the initial market ID counter based on the maximum
/// ID found in stable storage (or starts from 0 if none).
#[init]
fn init() {
    MARKET_ID.store(max_market_id(), std::sync::atomic::Ordering::SeqCst);
}

/// Called before canister upgrade to preserve state
///
/// This hook prepares data for persistence during canister upgrades.
/// The actual serialization of data to stable memory is handled by the
/// Rust runtime and stable structures implementation.
#[pre_upgrade]
fn pre_upgrade() {
    // No custom pre-upgrade logic needed as we're using stable structures
}

/// Called after canister upgrade to restore state
///
/// This hook restores data from stable memory after a canister upgrade.
/// It calls the custom restore function from the stable_memory module
/// to properly initialize all data structures with the persisted data.
/// 
/// No migrations are run for existing markets to maintain backward compatibility.
/// New markets will automatically use the latest token system, while existing ones 
/// maintain their original configuration.
#[post_upgrade]
fn post_upgrade() {
    stable_memory::restore();
    ic_cdk::println!("Successfully restored stable memory in post_upgrade");
    
    // No need to run migrations for existing markets as requested by the user
    // New markets will automatically use the new token system, while existing ones remain unchanged
}

// Export Candid interface
ic_cdk::export_candid!();
