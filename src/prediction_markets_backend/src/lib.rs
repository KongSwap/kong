//! Prediction Markets Smart Contract for Internet Computer
//! This module implements a decentralized prediction markets system where users can:
//! - Create markets with multiple possible outcomes
//! - Place bets on outcomes
//! - Resolve markets through various methods (admin, oracle, or decentralized)
//! - Automatically distribute winnings to successful bettors

use candid::Principal;
use ic_cdk::{post_upgrade, pre_upgrade};

use crate::balance::balance::*;
use crate::bet::bet::*;
use crate::canister::*;
use crate::category::market_category::*;
use crate::market::market::*;
use crate::nat::*;
use crate::resolution::resolution::*;
use crate::user::user::*;

pub mod controllers;
pub mod balance;
pub mod bet;
pub mod canister;
pub mod category;
pub mod market;
pub mod nat;
pub mod resolution;
pub mod stable_memory;
pub mod user;

// Constants
const KONG_LEDGER_ID: &str = "o7oak-iyaaa-aaaaq-aadzq-cai";

/// Called before canister upgrade to preserve state
#[pre_upgrade]
fn pre_upgrade_hook() {
    // Serialization handled by stable structures
}

/// Called after canister upgrade to restore state
#[post_upgrade]
fn post_upgrade_hook() {
    // Deserialization handled by stable structures
}

// Export Candid interface
ic_cdk::export_candid!();
