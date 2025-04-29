//! Prediction Markets Smart Contract for Internet Computer
//! This module implements a decentralized prediction markets system where users can:
//! - Create markets with multiple possible outcomes
//! - Place bets on outcomes
//! - Resolve markets through various methods (admin, oracle, or decentralized)
//! - Automatically distribute winnings to successful bettors

use candid::{Principal, decode_one};
use ic_cdk::{init, post_upgrade, pre_upgrade};

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
use crate::nat::*;
use crate::resolution::resolution::*;
use crate::user::user::*;
use crate::market::get_stats::*;
use icrc_ledger_types::icrc21::requests::ConsentMessageRequest;
use icrc_ledger_types::icrc21::responses::ConsentInfo; 
use icrc_ledger_types::icrc21::errors::ErrorInfo;

pub mod bet;
pub mod canister;
pub mod category;
pub mod controllers;
pub mod delegation;
pub mod market;
pub mod nat;
pub mod resolution;
pub mod stable_memory;
pub mod user;
pub mod utils;

// Constants
// const KONG_LEDGER_ID: &str = "o7oak-iyaaa-aaaaq-aadzq-cai"; ///Production KONG canister
const KONG_LEDGER_ID: &str = "aiewf-lx777-77775-aaaca-cai"; ///For Local testing

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
    MARKET_ID.store(max_market_id(), std::sync::atomic::Ordering::SeqCst);
}

// Export Candid interface
ic_cdk::export_candid!();
