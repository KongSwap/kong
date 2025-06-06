//! # Betting System Module
//! 
//! This module implements the core betting functionality for the Kong Swap prediction markets.
//! It defines the data structures for bets, error handling, and storage mechanisms needed
//! to track user bets throughout the market lifecycle.
//!
//! The betting system supports:
//! - Multi-token bets (KONG, ICP, etc.)
//! - Time-stamped bets (for time-weighted payouts)
//! - Stable storage for persistence across canister upgrades
//! 
//! Bets are recorded with their placement time, which is essential for markets using
//! time-weighted distribution, where earlier bettors receive higher rewards.

use candid::{CandidType, Principal};
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;

use crate::token::registry::TokenIdentifier;

use crate::nat::{serialize_nat, deserialize_nat};
use crate::types::{MarketId, Timestamp, TokenAmount, OutcomeIndex};

/// Possible errors when placing a bet
/// 
/// This enum encapsulates all potential failure modes during the betting process,
/// from validation errors to technical failures. It provides specific error types
/// to enable precise error handling and meaningful user feedback.
#[derive(CandidType, Debug)]
pub enum BetError {
    /// The specified market doesn't exist in the system
    MarketNotFound,
    
    /// The market has already reached its end time and is no longer accepting bets
    MarketClosed,
    
    /// The outcome index specified doesn't exist for this market
    InvalidOutcome,
    
    /// The user doesn't have enough tokens to place this bet
    InsufficientBalance,
    
    /// Failed to update the user's balance after the bet
    BalanceUpdateFailed,
    
    /// Failed to update the market data after recording the bet
    MarketUpdateFailed,
    
    /// Failed to record the bet in the system storage
    BetRecordingFailed,
    
    /// Token transfer operation failed with the specified error message
    TransferError(String),
    
    /// Market is still in pending status and not yet accepting bets
    /// This occurs when the market is created but not activated
    MarketNotActive,
    
    /// The bet amount is below the required threshold to activate the market
    /// For the first bet on a market, a minimum amount is required
    InsufficientActivationBet,
    
    /// Only the market creator can perform this betting operation
    /// Certain bet operations are restricted to market creators
    NotMarketCreator,
    
    /// The market is in a state where betting is not allowed
    /// (e.g., Voided, Disputed, or Closed)
    InvalidMarketStatus
}

/// Represents a bet placed by a user on a prediction market
/// 
/// This structure stores all relevant information about a bet, including the user,
/// market, amount, chosen outcome, and timing information. It's designed to support
/// both standard markets and time-weighted markets, where the timestamp of the bet
/// affects the potential payout.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Bet {
    /// Principal ID of the user who placed the bet
    pub user: Principal,
    
    /// ID of the market being bet on
    pub market_id: MarketId,
    
    /// Amount of tokens bet by the user
    /// Uses custom serialization to handle Nat values properly in stable storage
    #[serde(serialize_with = "serialize_nat", deserialize_with = "deserialize_nat")]
    pub amount: TokenAmount,
    
    /// Index of the outcome chosen by the bettor
    /// Corresponds to an index in the market's outcomes array
    #[serde(serialize_with = "serialize_nat", deserialize_with = "deserialize_nat")]
    pub outcome_index: OutcomeIndex,
    
    /// Timestamp when the bet was placed
    /// Critical for time-weighted markets where earlier bets get higher rewards
    pub timestamp: Timestamp,
    
    /// All bets in a market use the same token type as specified in the market
    pub token_id: TokenIdentifier
}

/// Implementation of the Storable trait for Bet
/// 
/// This enables individual Bet structs to be stored in stable memory,
/// allowing bet data to persist across canister upgrades.
impl Storable for Bet {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_json::to_vec(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_json::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

/// Wrapper around Vec<Bet> that implements the Storable trait for stable storage
/// 
/// This wrapper structure enables efficient storage and retrieval of collections of bets
/// using the Internet Computer's stable memory system. It ensures bets persist across
/// canister upgrades and system restarts, maintaining the integrity of betting records.
/// 
/// The implementation uses CBOR serialization for efficient binary encoding.
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct BetStore(pub Vec<Bet>);

/// Implementation of the Storable trait for BetStore
/// 
/// This enables the collection of bets to be stored in stable memory,
/// allowing bet data to persist across canister upgrades. The implementation
/// uses CBOR serialization for efficient encoding and supports unlimited size.
impl Storable for BetStore {
    /// Converts the collection of bets to a binary representation
    /// 
    /// # Returns
    /// * `Cow<[u8]>` - Binary representation of the bet collection
    fn to_bytes(&self) -> Cow<[u8]> {
        let mut buf = vec![];
        ciborium::ser::into_writer(self, &mut buf).unwrap();
        Cow::Owned(buf)
    }

    /// Reconstructs the bet collection from a binary representation
    /// 
    /// # Parameters
    /// * `bytes` - Binary data previously created by to_bytes()
    /// 
    /// # Returns
    /// * `Self` - Reconstructed BetStore instance
    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        ciborium::de::from_reader(bytes.as_ref()).unwrap()
    }

    /// Specifies that there's no size limit for this collection
    const BOUND: Bound = Bound::Unbounded;
}

/// Composite key for bets in stable storage
/// 
/// This struct combines MarketId and bet index to create a composite key
/// that avoids the limitations of tuple serialization in stable memory.
/// By implementing Storable with bounded serialization, we ensure the bet
/// collection can be properly stored and retrieved from stable memory.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, CandidType, Serialize, Deserialize)]
pub struct BetKey {
    /// The market ID component of the composite key
    pub market_id: MarketId,
    
    /// The bet index component (position within the market)
    pub bet_index: u64,
}

impl Storable for BetKey {
    /// Converts the composite key to a binary representation
    fn to_bytes(&self) -> Cow<[u8]> {
        let mut bytes = Vec::new();
        
        // Get the market ID bytes
        let market_id_bytes = self.market_id.to_bytes();
        
        // Add the market ID bytes size and content
        let market_id_size = market_id_bytes.len() as u32;
        bytes.extend_from_slice(&market_id_size.to_be_bytes());
        bytes.extend_from_slice(&market_id_bytes);
        
        // Add the bet index
        bytes.extend_from_slice(&self.bet_index.to_be_bytes());
        
        Cow::Owned(bytes)
    }
    
    /// Reconstructs the composite key from a binary representation
    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        let bytes = bytes.as_ref();
        
        // Read the market ID size
        let mut market_id_size_bytes = [0u8; 4];
        market_id_size_bytes.copy_from_slice(&bytes[0..4]);
        let market_id_size = u32::from_be_bytes(market_id_size_bytes) as usize;
        
        // Read the market ID
        let market_id_bytes = Cow::Borrowed(&bytes[4..4 + market_id_size]);
        let market_id = MarketId::from_bytes(market_id_bytes);
        
        // Read the bet index
        let mut bet_index_bytes = [0u8; 8];
        bet_index_bytes.copy_from_slice(&bytes[4 + market_id_size..4 + market_id_size + 8]);
        let bet_index = u64::from_be_bytes(bet_index_bytes);
        
        BetKey {
            market_id,
            bet_index,
        }
    }
    
    /// Specifies that this type has a bounded size for stable storage
    const BOUND: Bound = Bound::Bounded {
        max_size: 4 + 20 + 8, // 4 bytes for size + max 20 bytes for MarketId + 8 bytes for u64
        is_fixed_size: false,
    };
}
