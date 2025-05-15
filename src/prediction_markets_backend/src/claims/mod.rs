//! # Claims Module
//! 
//! This module implements the user-assisted claims system for Kong Swap prediction markets.
//! It enables users to claim their winnings after market resolution instead of automatically
//! receiving payouts, improving scalability and user experience.
//!
//! ## Core Functionality
//!
//! - **Claims Creation**: Generates claim records during market resolution
//! - **Claims Management**: Allows users to view and process their pending claims
//! - **Claims Processing**: Handles the actual token transfers when users claim
//! - **Batched Operations**: Supports claiming multiple markets at once
//!
//! ## Design Goals
//!
//! - **Scalability**: Distributes computational load by moving from automatic to user-initiated payouts
//! - **User Control**: Gives users more control over when to receive their winnings
//! - **Reliability**: Maintains comprehensive records of all claims and their status
//! - **Consistency**: Preserves existing time-weighted payout mechanics and platform fees

pub mod claims_types;
pub mod claims_api;
pub mod claims_storage;
pub mod claims_processing;
