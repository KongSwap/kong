//! Prediction Markets Smart Contract for Internet Computer
//! This module implements a decentralized prediction markets system where users can:
//! - Create markets with multiple possible outcomes
//! - Place bets on outcomes
//! - Resolve markets through various methods (admin, oracle, or decentralized)
//! - Automatically distribute winnings to successful bettors

mod queries;
pub use queries::*;

mod authentication;
pub use authentication::*;

use candid::Principal;
use ic_cdk::{caller, post_upgrade, pre_upgrade, query, update};
use std::str::FromStr;
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    storable::Bound,
    DefaultMemoryImpl, StableBTreeMap, Storable,
};
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::BTreeSet;
use std::borrow::Cow;
use std::sync::atomic::{AtomicU64, Ordering};
use ic_cdk::api::call;
use num_traits::{ToPrimitive, Zero, CheckedAdd, CheckedMul};
use std::ops::{Add, Sub, Mul, Div};

// Constants
const KONG_DECIMALS: u32 = 8;
const KONG_LEDGER_ID: &str = "o7oak-iyaaa-aaaaq-aadzq-cai";
lazy_static::lazy_static! {
    static ref KONG_TRANSFER_FEE: StorableNat = StorableNat(candid::Nat::from(10_000u64)); // 0.0001 KONG
}

// House fee is 0.1% (10 basis points) represented in NAT8
lazy_static::lazy_static! {
    static ref HOUSE_FEE_RATE: StorableNat = StorableNat(candid::Nat::from(100_000u64)); // 0.001 * 10^8 = 100,000
}
const FEES_ENABLED: bool = false;

// Helper function to get admin principal (canister's own principal)
fn get_admin_principal() -> Principal {
    ic_cdk::api::id()
}

// Type aliases for better code readability
type Memory = VirtualMemory<DefaultMemoryImpl>;
type MarketId = StorableNat;
type Timestamp = StorableNat;

// Wrapper around candid::Nat that implements Storable
#[derive(candid::CandidType, Serialize, Deserialize, Debug, PartialEq, Eq, Clone)]
struct StorableNat(candid::Nat);

impl StorableNat {
    pub fn to_f64(&self) -> f64 { 
        self.to_u64() as f64
    }

    pub fn to_u64(&self) -> u64 {
        self.0.0.to_u64().unwrap_or(0)
    }

    pub fn is_zero(&self) -> bool {
        self.0.0.to_u64().unwrap_or(0) == 0
    }

    pub fn from_u64(value: u64) -> Self {
        Self(candid::Nat::from(value))
    }

    pub fn inner(&self) -> &candid::Nat {
        &self.0
    }
}

impl Default for StorableNat {
    fn default() -> Self {
        Self(candid::Nat::from(0u64))
    }
}


impl PartialOrd for StorableNat {
    fn partial_cmp(&self, other: &Self) -> Option<std::cmp::Ordering> {
        self.0.0.partial_cmp(&other.0.0)
    }
}

impl Ord for StorableNat {
    fn cmp(&self, other: &Self) -> std::cmp::Ordering {
        self.0.0.to_u64().unwrap_or(0).cmp(&other.0.0.to_u64().unwrap_or(0))
    }
}

impl PartialEq<StorableNat> for u64 {
    fn eq(&self, other: &StorableNat) -> bool {
        *self == other.to_u64()
    }
}

impl PartialOrd<StorableNat> for u64 {
    fn partial_cmp(&self, other: &StorableNat) -> Option<std::cmp::Ordering> {
        Some(self.cmp(&other.to_u64()))
    }
}

impl PartialEq<u64> for StorableNat {
    fn eq(&self, other: &u64) -> bool {
        self.to_u64() == *other
    }
}

impl PartialEq<usize> for StorableNat {
    fn eq(&self, other: &usize) -> bool {
        self.to_u64() as usize == *other
    }
}

impl PartialOrd<usize> for StorableNat {
    fn partial_cmp(&self, other: &usize) -> Option<std::cmp::Ordering> {
        Some((self.to_u64() as usize).cmp(other))
    }
}

impl PartialOrd<u64> for StorableNat {
    fn partial_cmp(&self, other: &u64) -> Option<std::cmp::Ordering> {
        self.to_u64().partial_cmp(other)
    }
}


impl From<u64> for StorableNat {
    fn from(value: u64) -> Self {
        Self::from_u64(value)
    }
}

impl From<StorableNat> for u64 {
    fn from(value: StorableNat) -> Self {
        value.to_u64()
    }
}

impl From<StorableNat> for candid::Nat {
    fn from(value: StorableNat) -> Self {
        value.0.clone()
    }
}

impl Add for StorableNat {
    type Output = Self;
    fn add(self, other: Self) -> Self {
        Self(candid::Nat::from(CheckedAdd::checked_add(&self.0.0, &other.0.0).unwrap_or_else(Zero::zero)))
    }
}

impl Add<u64> for StorableNat {
    type Output = Self;
    fn add(self, other: u64) -> Self {
        self + Self::from(other)
    }
}

impl std::ops::AddAssign for StorableNat {
    fn add_assign(&mut self, other: Self) {
        *self = self.clone() + other;
    }
}

impl Sub for StorableNat {
    type Output = Self;
    fn sub(self, other: Self) -> Self {
        if self.0.0 >= other.0.0 {
            Self(candid::Nat::from(self.0.0 - other.0.0))
        } else {
            Self::default()
        }
    }
}

impl Sub<u64> for StorableNat {
    type Output = Self;
    fn sub(self, other: u64) -> Self {
        self - Self::from(other)
    }
}

impl Mul for StorableNat {
    type Output = Self;
    fn mul(self, other: Self) -> Self {
        Self(candid::Nat::from(CheckedMul::checked_mul(&self.0.0, &other.0.0).unwrap_or_else(Zero::zero)))
    }
}

impl Mul<u64> for StorableNat {
    type Output = Self;
    fn mul(self, other: u64) -> Self {
        self * Self::from(other)
    }
}

impl Div<u64> for StorableNat {
    type Output = Self;
    fn div(self, other: u64) -> Self {
        if other == 0 {
            Self::default()
        } else {
            Self(candid::Nat::from(self.0.0 / num_bigint::BigUint::from(other)))
        }
    }
}

impl std::iter::Sum for StorableNat {
    fn sum<I: Iterator<Item = Self>>(iter: I) -> Self {
        iter.fold(Self(candid::Nat::from(0u64)), |a, b| a + b)
    }
}

impl Storable for StorableNat {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_json::to_vec(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_json::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}
type Nat = StorableNat;

#[derive(candid::CandidType, Serialize, Deserialize, Debug)]
struct Account {
    owner: Principal,
}

#[derive(candid::CandidType, Serialize, Deserialize, Debug)]
struct TransferFromArgs {
    spender_subaccount: Option<Vec<u8>>,
    from: Account,
    to: Account,
    amount: candid::Nat,
    fee: Option<candid::Nat>,
    memo: Option<Vec<u8>>,
    created_at_time: Option<u64>,
}

#[derive(candid::CandidType, Serialize, Deserialize, Debug)]
struct TransferArgs {
    from_subaccount: Option<Vec<u8>>,
    to: Account,
    amount: candid::Nat,
    fee: Option<candid::Nat>,
    memo: Option<Vec<u8>>,
    created_at_time: Option<u64>,
}

#[derive(candid::CandidType, Deserialize, Debug)]
enum TransferError {
    BadFee { expected_fee: StorableNat },
    BadBurn { min_burn_amount: StorableNat },
    InsufficientFunds { balance: StorableNat },
    TooOld,
    CreatedInFuture { ledger_time: u64 },
    Duplicate { duplicate_of: StorableNat },
    TemporarilyUnavailable,
    GenericError { error_code: StorableNat, message: String },
}

async fn transfer_kong(to: Principal, amount: StorableNat) -> Result<(), String> {
    ic_cdk::println!("Transferring {} KONG to {}", amount.to_u64(), to.to_string());
    
    let args = TransferArgs {
        from_subaccount: None,
        to: Account { owner: to },
        amount: amount.inner().clone(),
        fee: None,
        memo: None,
        created_at_time: None,
    };

    let ledger = Principal::from_text(KONG_LEDGER_ID)
        .map_err(|e| format!("Invalid ledger ID: {}", e))?;

    match call::call::<_, (Result<candid::Nat, TransferError>,)>(ledger, "icrc1_transfer", (args,)).await {
        Ok((Ok(_block_index),)) => Ok(()),
        Ok((Err(e),)) => Err(format!("Transfer failed: {:?}", e)),
        Err((code, msg)) => Err(format!("Transfer failed: {} (code: {:?})", msg, code)),
    }
}

/// Represents different categories of prediction markets
#[derive(candid::CandidType, Serialize, Deserialize, Clone, Debug)]
enum MarketCategory {
    Crypto,      // Cryptocurrency related predictions
    Memes,       // Internet culture and meme predictions
    Sports,      // Sports events and outcomes
    Politics,    // Political events and outcomes
    KongMadness, // Kong Madness tournament predictions
    AI,          // Artificial Intelligence related predictions
    Other,       // Other categories not covered above
}

impl Storable for MarketCategory {
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

/// Wrapper around Vec<Bet> that implements Storable trait for stable storage
/// This allows us to store vectors of bets in the stable memory system
#[derive(candid::CandidType, Serialize, Deserialize, Clone, Debug, Default)]
struct BetStore(Vec<Bet>);

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

/// Represents a prediction market with its properties
#[derive(candid::CandidType, Serialize, Deserialize, Clone, Debug)]
struct Market {
    id: MarketId,
    creator: Principal,          // The creator's principal ID
    question: String,           // The question being predicted
    category: MarketCategory,   // The market category
    rules: String,             // Competition rules defined by creator
    outcomes: Vec<String>,      // Possible outcomes
    resolution_method: ResolutionMethod,
    status: MarketStatus,
    created_at: Timestamp,      // When the market was created
    end_time: Timestamp,        // When the market closes for betting
    total_pool: StorableNat,           // Total amount of tokens in the market
    resolution_data: Option<String>, // Additional data for resolution (e.g., oracle signatures)
    outcome_pools: Vec<StorableNat>,    // Amount in pool for each outcome
    outcome_percentages: Vec<f64>, // Percentage of total pool for each outcome
    bet_counts: Vec<StorableNat>,      // Number of bets for each outcome
    bet_count_percentages: Vec<f64>, // Percentage of total bets for each outcome
}

/// Legacy Market struct for migration
#[derive(candid::CandidType, Serialize, Deserialize, Clone, Debug)]
struct LegacyMarket {
    id: MarketId,
    creator: Principal,
    question: String,
    category: MarketCategory,
    outcomes: Vec<String>,
    resolution_method: ResolutionMethod,
    status: MarketStatus,
    end_time: Timestamp,
    total_pool: u64,
    resolution_data: Option<String>,
}

impl From<LegacyMarket> for Market {
    fn from(legacy: LegacyMarket) -> Self {
        let outcome_count = legacy.outcomes.len();
        Market {
            id: legacy.id,
            creator: legacy.creator,
            question: legacy.question,
            category: legacy.category,
            rules: "No rules specified (Legacy market)".to_string(), // Default rules for old markets
            outcomes: legacy.outcomes,
            resolution_method: legacy.resolution_method,
            status: legacy.status,
            created_at: StorableNat::from(0u64),
            end_time: legacy.end_time,
            total_pool: StorableNat::from(legacy.total_pool),
            resolution_data: legacy.resolution_data,
            outcome_pools: vec![StorableNat::default(); outcome_count],
            outcome_percentages: vec![0.0; outcome_count],
            bet_counts: vec![StorableNat::from(0u64); outcome_count],
            bet_count_percentages: vec![0.0; outcome_count],
        }
    }
}

impl Storable for Market {
    fn to_bytes(&self) -> Cow<[u8]> {
        let mut buf = vec![];
        ciborium::ser::into_writer(self, &mut buf)
            .expect("Failed to serialize Market");
        Cow::Owned(buf)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        // First try to deserialize as the current Market struct
        if let Ok(market) = ciborium::de::from_reader(bytes.as_ref()) {
            return market;
        }

        // If that fails, try to deserialize as LegacyMarket and convert
        match ciborium::de::from_reader(bytes.as_ref()) {
            Ok(legacy_market) => {
                let legacy: LegacyMarket = legacy_market;
                legacy.into()
            }
            Err(e) => {
                ic_cdk::trap(&format!("Failed to deserialize Market: {}", e));
            }
        }
    }

    const BOUND: Bound = Bound::Unbounded;
}

/// Represents the current status of a market
#[derive(candid::CandidType, Serialize, Deserialize, Clone, Debug)]
enum MarketStatus {
    Open,                    // Market is open for betting
    Closed(Vec<candid::Nat>),      // Market is closed with winning outcome indices
    Disputed,                // Market result is disputed
}

/// Defines how a market can be resolved
#[derive(candid::CandidType, Serialize, Deserialize, Clone, Debug)]
enum ResolutionMethod {
    Admin,                   // Only admin can resolve
    Oracle {
        oracle_principals: BTreeSet<Principal>,  // Authorized oracle principals
        required_confirmations: candid::Nat,           // Number of confirmations needed
    },
    Decentralized {
        quorum: candid::Nat,         // Required number of stake for resolution
    },
}

/// Represents a bet placed by a user
#[derive(candid::CandidType, Serialize, Deserialize, Clone, Debug)]
struct Bet {
    user: Principal,         // User who placed the bet
    market_id: MarketId,     // Market being bet on
    #[serde(serialize_with = "serialize_nat", deserialize_with = "deserialize_nat")]
    amount: StorableNat,           // Amount of tokens bet (NAT8)
    #[serde(serialize_with = "serialize_nat", deserialize_with = "deserialize_nat")]
    outcome_index: StorableNat,    // Index of the chosen outcome
    timestamp: Timestamp,    // When the bet was placed
}

fn serialize_nat<S>(nat: &StorableNat, serializer: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    serializer.serialize_str(&nat.inner().to_string())
}

fn deserialize_nat<'de, D>(deserializer: D) -> Result<StorableNat, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let s = String::deserialize(deserializer)?;
    let nat = candid::Nat::from_str(&s).map_err(serde::de::Error::custom)?;
    Ok(StorableNat(nat))
}

// Stable memory configuration using thread_local storage
thread_local! {
    /// Memory manager for stable storage allocation
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));
        
    /// Stores the accumulated house fees
    static FEE_BALANCE: RefCell<StableBTreeMap<Principal, u64, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(4))),
        )
    );

    /// Stores all markets indexed by their ID
    static MARKETS: RefCell<StableBTreeMap<MarketId, Market, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0))),
        )
    );

    /// Stores all bets for each market
    static BETS: RefCell<StableBTreeMap<MarketId, BetStore, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(1))),
        )
    );

    /// Stores user token balances
    static BALANCES: RefCell<StableBTreeMap<Principal, u64, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(2))),
        )
    );

    /// Stores whitelisted oracle principals
    static ORACLES: RefCell<StableBTreeMap<Principal, bool, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(3))),
        )
    );
}

#[derive(candid::CandidType, Deserialize)]
pub enum MarketEndTime {
    Duration(StorableNat),    // Duration in seconds from creation
    SpecificDate(StorableNat) // Unix timestamp for end date
}

/// Creates a new prediction market
#[update]
fn create_market(
    question: String,
    category: MarketCategory,
    rules: String,
    outcomes: Vec<String>,
    resolution_method: ResolutionMethod,
    end_time_spec: MarketEndTime,
) -> Result<MarketId, String> {
    // Validate inputs
    if question.is_empty() {
        return Err("Question cannot be empty".to_string());
    }
    if outcomes.len() < 2 {
        return Err("Market must have at least 2 outcomes".to_string());
    }
    if outcomes.len() > 10 {
        return Err("Market cannot have more than 10 outcomes".to_string());
    }
    
    let current_time = ic_cdk::api::time();
    
    // Calculate end time based on specification
    let end_time = match end_time_spec {
        MarketEndTime::Duration(duration_seconds) => {
            // Enforce minimum duration of 1 minute
            if duration_seconds.to_u64() < 60 {
                return Err("Duration must be at least 1 minute".to_string());
            }
            current_time + (duration_seconds.to_u64() * 1_000_000_000)
        },
        MarketEndTime::SpecificDate(end_date) => {
            let end_date_nanos = end_date.to_u64() * 1_000_000_000;
            if end_date_nanos <= current_time {
                return Err("End date must be in the future".to_string());
            }
            // Enforce minimum duration of 1 minute for specific dates too
            if end_date_nanos <= current_time + (60 * 1_000_000_000) {
                return Err("End date must be at least 1 minute in the future".to_string());
            }
            end_date_nanos
        }
    };

    let creator = ic_cdk::caller();
    
    MARKETS.with(|markets| {
        let market_id = StorableNat::from(NEXT_ID.fetch_add(1, Ordering::Relaxed));
        let outcome_count = outcomes.len();
        
        let mut markets_ref = markets.borrow_mut();
        markets_ref.insert(
            market_id.clone(),
            Market {
                id: market_id.clone(),
                creator,
                question,
                category,
                rules,
                outcomes,
                resolution_method,
                status: MarketStatus::Open,
                created_at: StorableNat::from(current_time),
                end_time: StorableNat::from(end_time),
                total_pool: StorableNat::from(0u64),
                resolution_data: None,
                outcome_pools: vec![StorableNat::from(0u64); outcome_count],
                outcome_percentages: vec![0.0; outcome_count],
                bet_counts: vec![StorableNat::from(0u64); outcome_count],
                bet_count_percentages: vec![0.0; outcome_count],
            },
        );
        
        Ok(market_id)
    })
}

/// Possible errors when placing a bet
#[derive(candid::CandidType, Deserialize, Debug)]
enum BetError {
    MarketNotFound,
    MarketClosed,
    InvalidOutcome,
    InsufficientBalance,
    BalanceUpdateFailed,
    MarketUpdateFailed,
    BetRecordingFailed,
    TransferError(String),
}

#[update]
/// Places a bet on a specific market outcome using KONG tokens
async fn place_bet(market_id: MarketId, outcome_index: StorableNat, amount: StorableNat) -> Result<(), BetError> {
    let user = caller();
    let market_id_clone = market_id.clone();
    
    // Get market and validate state
    let mut market = MARKETS.with(|markets| {
        let mut markets_ref = markets.borrow_mut();
        markets_ref.get(&market_id_clone).ok_or(BetError::MarketNotFound).map(|m| m.clone())
    })?;
    
    // Validate market state and outcome
    if !matches!(market.status, MarketStatus::Open) {
        return Err(BetError::MarketClosed);
    }
    let outcome_idx = outcome_index.to_u64() as usize;
    if outcome_idx >= market.outcomes.len() {
        return Err(BetError::InvalidOutcome);
    }
    
    // Calculate house fee (NAT8 arithmetic)
    let (fee_amount, bet_amount) = if FEES_ENABLED {
        let fee = amount.clone() * HOUSE_FEE_RATE.clone() / 100_000_000u64;
        (fee.clone(), amount.clone() - fee)
    } else {
        (StorableNat::from(0u64), amount.clone())
    };
    
    // Transfer tokens from user to the canister using icrc2_transfer_from
    let caller = ic_cdk::caller();
    let canister_id = ic_cdk::api::id();
    
    // Create the transfer_from arguments
    let args = TransferFromArgs {
        spender_subaccount: None,
        from: Account { owner: caller },
        to: Account { owner: canister_id },
        amount: amount.inner().clone(),
        fee: Some(candid::Nat::from(10_000u64)),
        memo: None,
        created_at_time: None,
    };
    
    let ledger = Principal::from_text(KONG_LEDGER_ID)
        .map_err(|e| BetError::TransferError(format!("Invalid ledger ID: {}", e)))?;
    
    match call::call::<_, (Result<candid::Nat, TransferError>,)>(ledger, "icrc2_transfer_from", (args,)).await {
        Ok((Ok(_block_index),)) => Ok(()),
        Ok((Err(e),)) => Err(BetError::TransferError(format!("Transfer failed: {:?}. Make sure you have approved the prediction market canister to spend your tokens using icrc2_approve", e))),
        Err((code, msg)) => Err(BetError::TransferError(format!("Transfer failed: {} (code: {:?})", msg, code))),
    }?;

    // Update fee balance
    let admin = get_admin_principal();
    FEE_BALANCE.with(|fees| {
        let mut fees = fees.borrow_mut();
        let current_fees = fees.get(&admin).unwrap_or(0);
        fees.insert(admin, (StorableNat::from(current_fees) + fee_amount).0.0.to_u64().unwrap_or(0));
    });

    // Update market pool with bet amount (excluding fee)
    market.total_pool = market.total_pool.clone() + bet_amount.clone();
    market.outcome_pools[outcome_idx] = market.outcome_pools[outcome_idx].clone() + bet_amount.clone();
    market.outcome_percentages = market.outcome_pools
        .iter()
        .map(|pool| if !market.total_pool.is_zero() {
            (pool.to_u64() as f64) / (market.total_pool.to_u64() as f64)
        } else {
            0.0
        })
        .collect();

    market.bet_counts[outcome_idx] = market.bet_counts[outcome_idx].clone() + 1u64;
    let total_bets: StorableNat = market.bet_counts.iter().cloned().sum();
    market.bet_count_percentages = market.bet_counts
        .iter()
        .map(|count| if total_bets > StorableNat::from(0u64) {
            count.to_f64() / total_bets.to_f64()
        } else {
            0.0
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

/// Possible errors during market resolution
#[derive(candid::CandidType, Deserialize, Debug)]
enum ResolutionError {
    Unauthorized,
    MarketNotFound,
    InvalidMethod,
    MarketStillOpen,  // New variant for timing-related errors
    AlreadyResolved,
    InvalidOutcome,
    UpdateFailed,
    PayoutFailed,
    TransferError(String),
}

/// Resolves a market through oracle confirmation
#[update]
async fn resolve_via_oracle(
    market_id: MarketId,
    outcome_indices: Vec<StorableNat>,
    _signature: Vec<u8>,
) -> Result<(), ResolutionError> {
    let oracle_principal = caller();
    
    // Verify oracle is whitelisted
    if !ORACLES.with(|o| o.borrow().contains_key(&oracle_principal)) {
        return Err(ResolutionError::Unauthorized);
    }

    // Get market and validate state
    let mut market = MARKETS.with(|markets| {
        let mut markets_ref = markets.borrow_mut();
        markets_ref.get(&market_id).ok_or(ResolutionError::MarketNotFound).map(|m| m.clone())
    })?;
    
    // Verify oracle is authorized for this market
    match &market.resolution_method {
        ResolutionMethod::Oracle { oracle_principals, required_confirmations } => {
            if !oracle_principals.contains(&oracle_principal) {
                return Err(ResolutionError::Unauthorized);
            }
            
            // Track oracle confirmations
            let mut confirmations = market.resolution_data
                .as_ref()
                .and_then(|d| serde_json::from_str::<Vec<Principal>>(d).ok())
                .unwrap_or_default();
            
            if !confirmations.contains(&oracle_principal) {
                confirmations.push(oracle_principal);
                market.resolution_data = Some(serde_json::to_string(&confirmations).unwrap());
            }
            
            // If enough confirmations, finalize the market
            if confirmations.len() >= required_confirmations.0.to_u64().unwrap_or(0) as usize {
                finalize_market(&mut market, outcome_indices).await?;
            }
        }
        _ => return Err(ResolutionError::InvalidMethod),
    }
    
    // Update market in storage
    MARKETS.with(|markets| {
        let mut markets_ref = markets.borrow_mut();
        markets_ref.insert(market_id, market);
    });
    
    Ok(())
}

/// Resolves a market through admin decision
#[update]
#[candid::candid_method(update)]
async fn resolve_via_admin(market_id: MarketId, outcome_indices: Vec<StorableNat>) -> Result<(), ResolutionError> {
    // Validate outcome indices are not empty
    if outcome_indices.is_empty() {
        return Err(ResolutionError::InvalidOutcome);
    }
    let admin = caller();
    
    // Get market and validate state
    let mut market = MARKETS.with(|markets| {
        let mut markets_ref = markets.borrow_mut();
        markets_ref.get(&market_id).ok_or(ResolutionError::MarketNotFound).map(|m| m.clone())
    })?;
    
    // Verify the caller is the market creator
    if market.creator != admin {
        return Err(ResolutionError::Unauthorized);
    }

    // Verify resolution method is Admin
    match market.resolution_method {
        ResolutionMethod::Admin => {},
        _ => return Err(ResolutionError::InvalidMethod),
    }

    // Verify market has ended
    if StorableNat::from(ic_cdk::api::time()) < market.end_time {
        return Err(ResolutionError::MarketStillOpen);
    }

    // Finalize the market with the chosen outcomes
    finalize_market(&mut market, outcome_indices).await?;

    // Update market in storage
    MARKETS.with(|markets| {
        let mut markets_ref = markets.borrow_mut();
        markets_ref.insert(market_id, market);
    });

    Ok(())
}

/// Finalizes a market by distributing winnings to successful bettors
async fn finalize_market(market: &mut Market, winning_outcomes: Vec<StorableNat>) -> Result<(), ResolutionError> {
    ic_cdk::println!("Finalizing market {} with winning outcomes {:?}", market.id.to_u64(), winning_outcomes.iter().map(|n| n.to_u64()).collect::<Vec<_>>());
    // Validate market state
    if !matches!(market.status, MarketStatus::Open) {
        return Err(ResolutionError::AlreadyResolved);
    }

    // Validate winning outcomes
    for outcome in &winning_outcomes {
        if outcome.to_u64() as usize >= market.outcomes.len() {
            return Err(ResolutionError::InvalidOutcome);
        }
    }

    // Calculate total winning pool
    let total_winning_pool: StorableNat = winning_outcomes
        .iter()
        .map(|i| market.outcome_pools[i.to_u64() as usize].clone())
        .sum();

    ic_cdk::println!("Total winning pool: {}", total_winning_pool.to_u64());
    ic_cdk::println!("Total market pool: {}", market.total_pool.to_u64());

    if total_winning_pool > StorableNat::from(0u64) {
        // Get all winning bets
        let winning_bets = BETS.with(|bets| {
            let bets = bets.borrow();
            if let Some(bet_store) = bets.get(&market.id) {
                bet_store.0
                    .iter()
                    .filter(|bet| winning_outcomes.iter().any(|x| x == &bet.outcome_index))
                    .cloned()
                    .collect::<Vec<_>>()
            } else {
                Vec::new()
            }
        });

        ic_cdk::println!("Found {} winning bets", winning_bets.len());

        // Distribute winnings
        for bet in winning_bets {
            let share = bet.amount.to_f64() / total_winning_pool.to_f64();
            let winnings = StorableNat::from((market.total_pool.to_u64() as f64 * share) as u64);

            ic_cdk::println!("Processing winning bet - User: {}, Original bet: {}, Share: {}, Raw winnings: {}", 
                bet.user.to_string(), bet.amount.to_u64(), share, winnings.to_u64());

            // Account for transfer fee
            let transfer_amount = if winnings > KONG_TRANSFER_FEE.clone() {
                winnings - KONG_TRANSFER_FEE.clone()
            } else {
                ic_cdk::println!("Skipping transfer - winnings {} less than fee {}", 
                    winnings.to_u64(), KONG_TRANSFER_FEE.to_u64());
                continue; // Skip if winnings are less than transfer fee
            };

            ic_cdk::println!("Transferring {} tokens to {}", transfer_amount.to_u64(), bet.user.to_string());

            // Transfer winnings to the bettor
            match transfer_kong(bet.user, transfer_amount).await {
                Ok(_) => ic_cdk::println!("Transfer successful"),
                Err(e) => {
                    ic_cdk::println!("Transfer failed: {}", e);
                    return Err(ResolutionError::TransferError(e))
                },
            }
        }
    }

    // Update market status
    market.status = MarketStatus::Closed(winning_outcomes.into_iter().map(|x| x.inner().clone()).collect());
    Ok(())
}

// Global atomic counter for generating unique market IDs
static NEXT_ID: AtomicU64 = AtomicU64::new(0);

// Helper to convert AtomicU64 to StorableNat
fn atomic_to_nat(atomic: &AtomicU64) -> StorableNat {
    StorableNat::from(atomic.load(Ordering::Relaxed))
}

/// Generates a unique market ID using atomic operations
fn generate_market_id() -> MarketId {
    StorableNat::from(NEXT_ID.fetch_add(1, Ordering::Relaxed))
}

#[derive(candid::CandidType, Deserialize)]
pub struct MarketResult {
    pub market: Market,
    pub winning_outcomes: Vec<StorableNat>,
    pub total_pool: StorableNat,
    pub winning_pool: StorableNat,
    pub outcome_pools: Vec<StorableNat>,  // Amount in pool for each outcome
    pub outcome_percentages: Vec<f64>,  // Percentage of total pool for each outcome
    pub bet_counts: Vec<StorableNat>,  // Number of bets for each outcome
    pub bet_count_percentages: Vec<f64>,  // Percentage of total bets for each outcome
    pub distributions: Vec<Distribution>,
}

#[derive(candid::CandidType, Deserialize)]
pub struct Distribution {
    pub user: Principal,
    pub outcome_index: StorableNat,
    pub bet_amount: StorableNat,
    pub winnings: StorableNat,
}

#[derive(candid::CandidType, Deserialize)]
pub struct MarketsByStatus {
    pub active: Vec<Market>,
    pub expired_unresolved: Vec<Market>,
    pub resolved: Vec<MarketResult>,
}

#[derive(candid::CandidType, Deserialize)]
pub struct UserBetInfo {
    pub market: Market,
    pub bet_amount: StorableNat,
    pub outcome_index: StorableNat,
    pub outcome_text: String,
    pub winnings: Option<StorableNat>,  // None if market not resolved, Some(0) if lost, Some(amount) if won
}

#[derive(candid::CandidType, Deserialize)]
pub struct UserHistory {
    pub active_bets: Vec<UserBetInfo>,    // Bets in markets that are still open
    pub pending_resolution: Vec<UserBetInfo>,  // Bets in markets that are expired but not resolved
    pub resolved_bets: Vec<UserBetInfo>,   // Bets in markets that are resolved
    pub total_wagered: StorableNat,
    pub total_won: StorableNat,
    pub current_balance: StorableNat,
}

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

#[derive(candid::CandidType)]
struct GetFeeBalanceResult {
    admin_principal: Principal,
    balance: StorableNat,
}

// Export Candid interface
ic_cdk::export_candid!();