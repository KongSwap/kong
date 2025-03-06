use candid::{CandidType, Principal};
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;

use crate::nat::*;

/// Possible errors when placing a bet
#[derive(CandidType, Debug)]
pub enum BetError {
    MarketNotFound,
    MarketClosed,
    InvalidOutcome,
    InsufficientBalance,
    BalanceUpdateFailed,
    MarketUpdateFailed,
    BetRecordingFailed,
    TransferError(String),
}

/// Represents a bet placed by a user
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Bet {
    pub user: Principal,     // User who placed the bet
    pub market_id: MarketId, // Market being bet on
    #[serde(serialize_with = "serialize_nat", deserialize_with = "deserialize_nat")]
    pub amount: StorableNat, // Amount of tokens bet (NAT8)
    #[serde(serialize_with = "serialize_nat", deserialize_with = "deserialize_nat")]
    pub outcome_index: StorableNat, // Index of the chosen outcome
    pub timestamp: Timestamp, // When the bet was placed
}

/// Wrapper around Vec<Bet> that implements Storable trait for stable storage
/// This allows us to store vectors of bets in the stable memory system
#[derive(CandidType, Serialize, Deserialize, Clone, Debug, Default)]
pub struct BetStore(pub Vec<Bet>);

impl Storable for BetStore {
    fn to_bytes(&self) -> Cow<[u8]> {
        let mut buf = vec![];
        ciborium::ser::into_writer(self, &mut buf).unwrap();
        Cow::Owned(buf)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        ciborium::de::from_reader(bytes.as_ref()).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}
