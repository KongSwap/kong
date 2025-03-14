// src/token_backend/src/mining.rs

use candid::Nat;
use candid::Principal;
use candid::{CandidType, Deserialize};
use ciborium;
use ic_cdk::api::call::call;
use ic_stable_structures::storable::Bound;
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl, StableCell, Storable,
};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::TransferArg;
use serde::Serialize;
use std::borrow::Cow;
use std::cell::RefCell;

use crate::block_templates::{BlockTemplate, Event, EventType, Hash};
use crate::types::MiningInfo;

type Memory = VirtualMemory<DefaultMemoryImpl>;

/// Returns the version of the mining module implementation
#[ic_cdk::query]
pub fn mining_version() -> String {
    "v1.0.0".to_string()
}

// Wrapper for Vec<u64> to implement Storable
#[derive(Debug, Clone)]
struct StorableTimestamps(Vec<u64>);

impl Storable for StorableTimestamps {
    fn to_bytes(&self) -> Cow<[u8]> {
        if self.0.is_empty() {
            return Cow::Borrowed(&[]);
        }
        let mut bytes = vec![0u8; self.0.len() * 8];
        for (i, &timestamp) in self.0.iter().enumerate() {
            bytes[i * 8..(i + 1) * 8].copy_from_slice(&timestamp.to_le_bytes());
        }
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        if bytes.is_empty() {
            return StorableTimestamps(Vec::new());
        }
        let mut timestamps = Vec::with_capacity(bytes.len() / 8);
        for chunk in bytes.chunks_exact(8) {
            let mut buf = [0u8; 8];
            buf.copy_from_slice(chunk);
            timestamps.push(u64::from_le_bytes(buf));
        }
        StorableTimestamps(timestamps)
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 1024 * 8,
        is_fixed_size: false,
    };
}

// Create a newtype wrapper for Hash to implement Storable
#[derive(Debug, Clone, Copy)]
struct StorableHash(Hash);

impl From<Hash> for StorableHash {
    fn from(hash: Hash) -> Self {
        Self(hash)
    }
}

impl From<StorableHash> for Hash {
    fn from(hash: StorableHash) -> Self {
        hash.0
    }
}

impl Storable for StorableHash {
    fn to_bytes(&self) -> Cow<[u8]> {
        // Direct borrow of the fixed-size array
        Cow::Borrowed(&self.0)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        let mut hash = [0u8; 32];
        hash.copy_from_slice(&bytes[0..32]);
        Self(hash)
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 32,
        is_fixed_size: true,
    };
}

// Create a newtype wrapper for solution tracking
#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
struct StorableSolution {
    nonce: u64,
    hash: Hash,
    block_height: u64,
    timestamp: u64,
}

impl Storable for StorableSolution {
    fn to_bytes(&self) -> Cow<[u8]> {
        let mut bytes = Vec::with_capacity(56);
        bytes.extend_from_slice(&self.nonce.to_le_bytes());
        bytes.extend_from_slice(&self.hash);
        bytes.extend_from_slice(&self.block_height.to_le_bytes());
        bytes.extend_from_slice(&self.timestamp.to_le_bytes());
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        let bytes = bytes.as_ref();
        debug_assert!(bytes.len() >= 56, "StorableSolution requires 56 bytes");

        Self {
            nonce: u64::from_le_bytes(bytes[0..8].try_into().unwrap()),
            hash: bytes[8..40].try_into().unwrap(),
            block_height: u64::from_le_bytes(bytes[40..48].try_into().unwrap()),
            timestamp: u64::from_le_bytes(bytes[48..56].try_into().unwrap()),
        }
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 56,
        is_fixed_size: true,
    };
}

// Wrapper for Vec<StorableSolution> to implement Storable
#[derive(Debug, Clone)]
struct StorableSolutions(Vec<StorableSolution>);

impl Storable for StorableSolutions {
    fn to_bytes(&self) -> Cow<[u8]> {
        if self.0.is_empty() {
            return Cow::Borrowed(&[]);
        }
        let mut bytes = Vec::new();
        ciborium::ser::into_writer(&self.0, &mut bytes).expect("Failed to serialize solutions");
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Self(ciborium::de::from_reader(bytes.as_ref()).expect("Failed to deserialize solutions"))
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 56 * 100, // Max 100 solutions of 56 bytes each
        is_fixed_size: false,
    };
}

// Bloom filter for fast solution verification
#[derive(Debug, Clone)]
struct BloomFilter {
    data: [u8; 1024], // 8192 bits
    k: u32,           // Number of hash functions
}

impl BloomFilter {
    fn new() -> Self {
        Self { data: [0; 1024], k: 3 }
    }

    fn hash(&self, data: &[u8], seed: u32) -> usize {
        let mut hash: u64 = 5381;
        for &byte in data {
            hash = ((hash << 5).wrapping_add(hash)).wrapping_add(byte as u64);
        }
        hash = hash.wrapping_add(seed as u64);
        (hash % (self.data.len() * 8) as u64) as usize
    }

    fn add(&mut self, solution: &StorableSolution) {
        let mut data = Vec::with_capacity(48);
        data.extend_from_slice(&solution.nonce.to_le_bytes());
        data.extend_from_slice(&solution.hash);
        data.extend_from_slice(&solution.block_height.to_le_bytes());

        for i in 0..self.k {
            let pos = self.hash(&data, i);
            let byte_pos = pos / 8;
            let bit_pos = pos % 8;
            self.data[byte_pos] |= 1 << bit_pos;
        }
    }

    fn might_contain(&self, solution: &StorableSolution) -> bool {
        let mut data = Vec::with_capacity(48);
        data.extend_from_slice(&solution.nonce.to_le_bytes());
        data.extend_from_slice(&solution.hash);
        data.extend_from_slice(&solution.block_height.to_le_bytes());

        for i in 0..self.k {
            let pos = self.hash(&data, i);
            let byte_pos = pos / 8;
            let bit_pos = pos % 8;
            if self.data[byte_pos] & (1 << bit_pos) == 0 {
                return false;
            }
        }
        true
    }
}

impl Storable for BloomFilter {
    fn to_bytes(&self) -> Cow<[u8]> {
        let mut bytes = Vec::with_capacity(1028);
        bytes.extend_from_slice(&self.k.to_le_bytes());
        bytes.extend_from_slice(&self.data);
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        let bytes = bytes.as_ref();
        debug_assert!(bytes.len() >= 1028, "BloomFilter requires 1028 bytes");

        let mut data = [0u8; 1024];
        data.copy_from_slice(&bytes[4..1028]);

        Self {
            data,
            k: u32::from_le_bytes(bytes[0..4].try_into().unwrap()),
        }
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 1028,
        is_fixed_size: true,
    };
}

// Rate limiting for miners
#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
struct MinerRateLimit {
    submissions_per_minute: u32,
    last_submission: u64,
    submission_count: u32,
}

impl Default for MinerRateLimit {
    fn default() -> Self {
        Self {
            submissions_per_minute: 60,
            last_submission: 0,
            submission_count: 0,
        }
    }
}

impl Storable for MinerRateLimit {
    fn to_bytes(&self) -> Cow<[u8]> {
        let mut bytes = Vec::with_capacity(16);
        bytes.extend_from_slice(&self.submissions_per_minute.to_le_bytes());
        bytes.extend_from_slice(&self.last_submission.to_le_bytes());
        bytes.extend_from_slice(&self.submission_count.to_le_bytes());
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        let bytes = bytes.as_ref();
        debug_assert!(bytes.len() >= 16, "MinerRateLimit requires 16 bytes");

        Self {
            submissions_per_minute: u32::from_le_bytes(bytes[0..4].try_into().unwrap()),
            last_submission: u64::from_le_bytes(bytes[4..12].try_into().unwrap()),
            submission_count: u32::from_le_bytes(bytes[12..16].try_into().unwrap()),
        }
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 16,
        is_fixed_size: true,
    };
}

// Wrapper for HashMap<Principal, MinerRateLimit> to implement Storable
#[derive(Debug, Clone)]
struct StorableRateLimits(std::collections::HashMap<Principal, MinerRateLimit>);

impl Storable for StorableRateLimits {
    fn to_bytes(&self) -> Cow<[u8]> {
        let vec: Vec<(Principal, MinerRateLimit)> = self.0.iter().map(|(&k, v)| (k, v.clone())).collect();
        let mut bytes = Vec::new();
        ciborium::ser::into_writer(&vec, &mut bytes).expect("Failed to serialize rate limits");
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        let vec: Vec<(Principal, MinerRateLimit)> = ciborium::de::from_reader(bytes.as_ref()).expect("Failed to deserialize rate limits");
        Self(vec.into_iter().collect())
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 1024 * 64, // Allow up to 1024 rate limits
        is_fixed_size: false,
    };
}

// Event batching for improved scalability
#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
pub struct EventBatch {
    pub events: Vec<Event>,
    pub block_height: u64,
    pub timestamp: u64,
}

impl Storable for EventBatch {
    fn to_bytes(&self) -> Cow<[u8]> {
        let mut bytes = Vec::new();
        ciborium::ser::into_writer(self, &mut bytes).expect("Failed to serialize EventBatch");
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        ciborium::de::from_reader(bytes.as_ref()).expect("Failed to deserialize EventBatch")
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 1024 * 64, // 64KB per batch
        is_fixed_size: false,
    };
}

// Wrapper for Vec<EventBatch> to implement Storable
#[derive(Debug, Clone)]
struct StorableEventBatches(Vec<EventBatch>);

impl Storable for StorableEventBatches {
    fn to_bytes(&self) -> Cow<[u8]> {
        let mut bytes = Vec::new();
        ciborium::ser::into_writer(&self.0, &mut bytes).expect("Failed to serialize event batches");
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Self(ciborium::de::from_reader(bytes.as_ref()).expect("Failed to deserialize event batches"))
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 1024 * 256, // Allow up to 256KB of batches
        is_fixed_size: false,
    };
}

// Wrapper for i64 to implement Storable
#[derive(Debug, Clone, Copy)]
struct StorableI64(i64);

impl From<i64> for StorableI64 {
    fn from(val: i64) -> Self {
        Self(val)
    }
}

impl From<StorableI64> for i64 {
    fn from(val: StorableI64) -> Self {
        val.0
    }
}

impl Storable for StorableI64 {
    fn to_bytes(&self) -> Cow<[u8]> {
        let mut bytes = Vec::with_capacity(8);
        bytes.extend_from_slice(&self.0.to_le_bytes());
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        let bytes = bytes.as_ref();
        debug_assert!(bytes.len() >= 8, "StorableI64 requires 8 bytes");
        Self(i64::from_le_bytes(bytes[0..8].try_into().unwrap()))
    }
    const BOUND: Bound = Bound::Bounded {
        max_size: 8,
        is_fixed_size: true,
    };
}

// Add LRU cache for recent solution verifications
use lru::LruCache;
use std::num::NonZeroUsize;
thread_local! {
    static SOLUTION_CACHE: RefCell<LruCache<(u64, Hash), ()>> = RefCell::new(
        LruCache::new(NonZeroUsize::new(1000).unwrap())
    );
}

thread_local! {
    // Get memory manager from parent
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
        MemoryManager::init(DefaultMemoryImpl::default())
    );

    // Mining state in stable memory
    static CURRENT_BLOCK: RefCell<StableCell<Option<BlockTemplate>, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(8))),
            None
        ).expect("Failed to init CURRENT_BLOCK")
    );

    static LAST_BLOCK_HASH: RefCell<StableCell<StorableHash, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(9))),
            StorableHash([0; 32])
        ).expect("Failed to init LAST_BLOCK_HASH")
    );

    static BLOCK_HEIGHT: RefCell<StableCell<u64, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(10))),
            0
        ).expect("Failed to init BLOCK_HEIGHT")
    );

    static MINING_DIFFICULTY: RefCell<StableCell<u32, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(11))),
            0
        ).expect("Failed to init MINING_DIFFICULTY")
    );

    static BLOCK_REWARD: RefCell<StableCell<u64, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(12))),
            0
        ).expect("Failed to init BLOCK_REWARD")
    );

    static BLOCK_TIME_TARGET: RefCell<StableCell<u64, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(13))),
            0
        ).expect("Failed to init BLOCK_TIME_TARGET")
    );

    static BLOCK_TIMESTAMPS: RefCell<StableCell<StorableTimestamps, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(15))),
            StorableTimestamps(Vec::new())
        ).expect("Failed to init BLOCK_TIMESTAMPS")
    );

    static PROCESSED_SOLUTIONS: RefCell<StableCell<StorableSolutions, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(16))),
            StorableSolutions(Vec::new())
        ).expect("Failed to init PROCESSED_SOLUTIONS")
    );

    static SOLUTION_BLOOM_FILTER: RefCell<StableCell<BloomFilter, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(17))),
            BloomFilter::new()
        ).expect("Failed to init SOLUTION_BLOOM_FILTER")
    );

    static MINER_RATE_LIMITS: RefCell<StableCell<StorableRateLimits, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(18))),
            StorableRateLimits(std::collections::HashMap::new())
        ).expect("Failed to init MINER_RATE_LIMITS")
    );

    static EVENT_BATCHES: RefCell<StableCell<StorableEventBatches, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(19))),
            StorableEventBatches(Vec::new())
        ).expect("Failed to init EVENT_BATCHES")
    );

    // Add ASERT time offset tracking
    static ASERT_TIME_OFFSET: RefCell<StableCell<StorableI64, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(20))),
            StorableI64(0)
        ).expect("Failed to init ASERT_TIME_OFFSET")
    );

    // Add total cycles tracking
    static TOTAL_CYCLES_EARNED: RefCell<StableCell<u128, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(21))),
            0
        ).expect("Failed to init TOTAL_CYCLES_EARNED")
    );

    // Track consecutive slow blocks
    static CONSECUTIVE_SLOW_BLOCKS: RefCell<u32> = RefCell::new(0);

    // Track consecutive fast blocks too
    static CONSECUTIVE_FAST_BLOCKS: RefCell<u32> = RefCell::new(0);

    // Add heartbeat counter
    static HEARTBEAT_COUNTER: RefCell<u32> = RefCell::new(0);

    // Add halving interval
    static HALVING_INTERVAL: RefCell<StableCell<u64, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(14))),
            0
        ).expect("Failed to init HALVING_INTERVAL")
    );

    // Add a dedicated flag for tracking genesis block generation
    static GENESIS_BLOCK_GENERATED: RefCell<StableCell<bool, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(24))), // Use an available memory ID
            false
        ).expect("Failed to init GENESIS_BLOCK_GENERATED")
    );
}

pub fn init_mining_params(initial_block_reward: u64, block_time_target: u64, halving_interval: u64) {
    BLOCK_REWARD.with(|r| {
        r.borrow_mut().set(initial_block_reward).expect("Failed to set block reward");
    });

    MINING_DIFFICULTY.with(|d| {
        d.borrow_mut().set(10).expect("Failed to set mining difficulty");
    });

    BLOCK_TIME_TARGET.with(|t| {
        t.borrow_mut().set(block_time_target).expect("Failed to set block time target");
    });

    HALVING_INTERVAL.with(|h| {
        h.borrow_mut().set(halving_interval).expect("Failed to set halving interval");
    });

    // Initialize empty timestamps vector
    BLOCK_TIMESTAMPS.with(|t| {
        t.borrow_mut()
            .set(StorableTimestamps(Vec::new()))
            .expect("Failed to init timestamps");
    });

    // Initialize block height to 0
    BLOCK_HEIGHT.with(|h| {
        h.borrow_mut().set(0).expect("Failed to init block height");
    });

    // Initialize last block hash to zeros
    LAST_BLOCK_HASH.with(|h| {
        h.borrow_mut().set(StorableHash([0; 32])).expect("Failed to init last block hash");
    });
}
// Difficulty adjustment parameters and functions
// --------------------------------------------

#[derive(Debug, Clone)]
struct AdjustmentCache {
    last_target_time: u64,
    min_diff: u32,
    max_diff: u32,
    increase_factor: f64,
    decrease_factor: f64,
    half_life: f64,
}

thread_local! {
static ADJUSTMENT_CACHE: RefCell<Option<AdjustmentCache>> = RefCell::new(None);
}

/// Calculates difficulty adjustment parameters based on the target block time.
/// Returns a tuple of (min_difficulty, max_difficulty, increase_factor, decrease_factor, half_life)
/// that are appropriately scaled for the given target time.
fn get_adjustment_factors(target_time: u64) -> (u32, u32, f64, f64, f64) {
    // Base parameters calibrated for wide range (3s to 1hr blocks)
    const BASE_MIN_DIFF: u32 = 5; // Higher minimum for fast block protection
    const BASE_MAX_DIFF: u32 = 12_000; // Increased maximum ceiling
    const BASE_INCREASE: f64 = 1.15; // More conservative 15% max increase
    const BASE_DECREASE: f64 = 0.88; // More gradual 12% max decrease
    const BASE_HALF_LIFE: f64 = 0.12; // Slower response time base

    // Logarithmic scaling for wide time range
    let time_ratio = (target_time as f64) / 60.0;
    let log_scale = (time_ratio.ln().exp() - 1.0).ln().max(0.0) + 1.0;
    let time_factor = (time_ratio + 1.0).log2(); // Handle sub-minute ranges better

    // Calculate scaled parameters with non-linear adjustments
    let min_diff = BASE_MIN_DIFF;
    let max_diff = ((BASE_MAX_DIFF as f64) * time_factor.sqrt()).clamp(100.0, 100_000.0) as u32;

    // Dynamic scaling factors with upper/lower bounds
    let increase = 1.0 + ((BASE_INCREASE - 1.0) * (1.0 / log_scale)).clamp(0.01, 0.5);
    let decrease = 1.0 - ((1.0 - BASE_DECREASE) * (1.0 / log_scale)).clamp(0.01, 0.3);

    // Adaptive half-life calculation with minimum bound
    let half_life = (BASE_HALF_LIFE * time_factor.sqrt()).clamp(0.01, 2.0);

    (min_diff, max_diff, increase, decrease, half_life)
}

/// Adjusts mining difficulty based on block time variations and consecutive block patterns.
fn adjust_difficulty_asert() -> u32 {
    // Get current mining parameters
    let target_time = BLOCK_TIME_TARGET.with(|t| *t.borrow().get());
    let current_diff = MINING_DIFFICULTY.with(|d| *d.borrow().get());
    let now = ic_cdk::api::time() / 1_000_000_000;

    // Get cached factors or calculate new ones if target time changed
    let (min_diff, max_diff, increase_factor, decrease_factor, half_life) = ADJUSTMENT_CACHE.with(|cache| {
        let mut cache = cache.borrow_mut();
        match &*cache {
            Some(c) if c.last_target_time == target_time => {
                // Return cached values
                (c.min_diff, c.max_diff, c.increase_factor, c.decrease_factor, c.half_life)
            }
            _ => {
                // Calculate new values and update cache
                let (min, max, inc, dec, hl) = get_adjustment_factors(target_time);
                *cache = Some(AdjustmentCache {
                    last_target_time: target_time,
                    min_diff: min,
                    max_diff: max,
                    increase_factor: inc,
                    decrease_factor: dec,
                    half_life: hl,
                });
                (min, max, inc, dec, hl)
            }
        }
    });

    // Get timestamp of last block
    let last_timestamp = BLOCK_TIMESTAMPS.with(|ts| {
        let data = ts.borrow().get().0.clone();
        if data.is_empty() {
            now
        } else {
            data[data.len() - 1] / 1_000_000_000
        }
    });

    // Calculate actual time since last block
    let actual_time = now.saturating_sub(last_timestamp);

    // Calculate dynamic half-life based on target block time
    let half_life_seconds = (target_time as f64 * half_life).max(1.0);

    // Get consecutive block counters
    let consecutive_fast = CONSECUTIVE_FAST_BLOCKS.with(|c| *c.borrow());
    let consecutive_slow = CONSECUTIVE_SLOW_BLOCKS.with(|c| *c.borrow());

    // Calculate adjustment multipliers based on consecutive blocks
    let mut increase_multiplier = if consecutive_fast > 0 {
        1.0 + (consecutive_fast as f64 * 0.1) // 10% stronger per consecutive fast block
    } else {
        1.0
    };

    let mut decrease_multiplier = if consecutive_slow > 0 {
        1.0 + (consecutive_slow as f64 * 0.15) // 15% stronger per consecutive slow block
    } else {
        1.0
    };

    // Cap multipliers to prevent extreme adjustments
    increase_multiplier = increase_multiplier.min(3.0);
    decrease_multiplier = decrease_multiplier.min(3.0);

    // Update consecutive block counters only for actual mined blocks (not heartbeats)
    let is_heartbeat = ic_cdk::caller() == ic_cdk::api::id();
    if !is_heartbeat {
        let is_slow_block = actual_time > target_time * 5 / 4; // 25% slower than target
        let is_fast_block = actual_time < target_time * 2 / 3; // 33% faster than target

        // Update fast block counter
        CONSECUTIVE_FAST_BLOCKS.with(|c| {
            let mut count = c.borrow_mut();
            *count = if is_fast_block { *count + 1 } else { 0 };
        });

        // Update slow block counter
        CONSECUTIVE_SLOW_BLOCKS.with(|c| {
            let mut count = c.borrow_mut();
            *count = if is_slow_block { *count + 1 } else { 0 };
        });
    }

    // Calculate exponential difficulty adjustment
    let time_diff = target_time as f64 - actual_time as f64;
    let exponent = time_diff / half_life_seconds;
    let raw_adjustment = 2f64.powf(exponent);

    // Apply asymmetric adjustment factors
    let adjustment_factor = if raw_adjustment > 1.0 {
        (raw_adjustment * increase_multiplier).min(increase_factor)
    } else {
        (raw_adjustment * decrease_multiplier).max(decrease_factor)
    };

    // Calculate and clamp new difficulty
    let new_diff = (current_diff as f64 * adjustment_factor) as u32;
    let new_diff = new_diff.clamp(min_diff, max_diff);
    new_diff
}

#[ic_cdk::query]
pub fn get_current_block() -> Option<BlockTemplate> {
    // Check if the ledger is deployed
    let ledger_deployed = crate::LEDGER_ID_CELL.with(|id| id.borrow().get().is_some());

    // Check if genesis block has been generated
    let genesis_generated = GENESIS_BLOCK_GENERATED.with(|g| *g.borrow().get());

    // Get the current block template
    let current_block = CURRENT_BLOCK.with(|b| b.borrow().get().clone());

    // If no block is available, log the reason
    if current_block.is_none() {
        if !ledger_deployed {
            ic_cdk::println!("Warning: get_current_block called but ledger is not deployed yet");
        } else if !genesis_generated {
            ic_cdk::println!("Warning: get_current_block called but genesis block has not been generated yet");
        } else {
            ic_cdk::println!("Warning: get_current_block called but no block template is available");
        }
    }

    current_block
}

fn calculate_block_reward(block_height: u64) -> u64 {
    BLOCK_REWARD.with(|r| {
        let initial_reward = *r.borrow().get();

        // Get halving interval from stable storage
        let halving_interval = HALVING_INTERVAL.with(|h| *h.borrow().get());

        // If halving_interval is 0, use continuous emission (always same reward)
        if halving_interval == 0 {
            return initial_reward;
        }

        // Calculate number of halvings that have occurred
        let halvings = block_height / halving_interval;

        // After 64 halvings reward becomes 0
        if halvings >= 64 {
            0
        } else {
            initial_reward >> halvings // Bit shift right = divide by 2^halvings
        }
    })
}

// Batch size configuration
const MAX_EVENTS_PER_BATCH: usize = 100;

fn should_add_event_to_batch(height: u64) -> bool {
    EVENT_BATCHES.with(|batches| {
        let batches = batches.borrow();
        batches.get().0.last().map_or(true, |last| last.block_height != height)
    })
}

fn add_event_to_batch(event: Event) {
    EVENT_BATCHES.with(|batches| {
        let mut batches = batches.borrow_mut();
        let current_batches = batches.get();

        let mut new_events = Vec::with_capacity(MAX_EVENTS_PER_BATCH);
        new_events.push(event);

        let new_batch = EventBatch {
            events: new_events,
            block_height: BLOCK_HEIGHT.with(|h| *h.borrow().get()),
            timestamp: ic_cdk::api::time(),
        };

        let mut current_batches = current_batches.0.to_vec();
        current_batches.push(new_batch);
        batches
            .set(StorableEventBatches(current_batches))
            .expect("Failed to update event batches");
    });
}

// Replace direct event generation with batched version
fn generate_events(height: u64, old_difficulty: u32, new_difficulty: u32) -> Vec<Event> {
    let current_time = ic_cdk::api::time() / 1_000_000_000; // Convert to seconds
    let mut events = Vec::new();
    let mut batch_events = Vec::new();

    // Add difficulty adjustment event if difficulty changed
    if old_difficulty != new_difficulty {
        let event = Event {
            event_type: EventType::DifficultyAdjustment {
                old_difficulty,
                new_difficulty,
                reason: format!("Block time adjustment at height {}", height),
            },
            timestamp: current_time,
            block_height: height,
        };
        events.push(event.clone());

        // Collect events for batching
        if should_add_event_to_batch(height) {
            batch_events.push(event);
        }
    }

    // Check for reward halving
    let reward = calculate_block_reward(height);
    let prev_reward = calculate_block_reward(height - 1);
    if reward != prev_reward {
        let event = Event {
            event_type: EventType::RewardHalving {
                new_reward: reward,
                block_height: height,
            },
            timestamp: current_time,
            block_height: height,
        };
        events.push(event.clone());

        // Collect events for batching
        if should_add_event_to_batch(height) {
            batch_events.push(event);
        }
    }

    // Check for mining milestones
    for miner_info in crate::get_miners() {
        // Check various milestone thresholds
        let milestones = [
            (10, "IC Cadet"),
            (100, "Canister Captain"),
            (1000, "Cycles Sovereign"),
            (10000, "Internet Computer Legend"),
        ];

        for (threshold, title) in milestones.iter() {
            if miner_info.stats.blocks_mined == *threshold {
                let event = Event {
                    event_type: EventType::MiningMilestone {
                        miner: miner_info.principal,
                        achievement: title.to_string(),
                        blocks_mined: miner_info.stats.blocks_mined,
                    },
                    timestamp: current_time,
                    block_height: height,
                };
                events.push(event.clone());

                // Collect events for batching
                if should_add_event_to_batch(height) {
                    batch_events.push(event);
                }
            }
        }
    }

    // Add all collected events to batch at once
    for event in batch_events {
        add_event_to_batch(event);
    }

    events
}

// Add query method to get event batches
#[ic_cdk::query]
pub fn get_event_batches(start_height: Option<u64>) -> Vec<EventBatch> {
    EVENT_BATCHES.with(|batches| {
        let all_batches = batches.borrow().get().0.clone();
        if let Some(height) = start_height {
            all_batches.into_iter().filter(|batch| batch.block_height >= height).collect()
        } else {
            all_batches
        }
    })
}

pub async fn generate_new_block() -> Result<BlockTemplate, String> {
    // Get current block height and check security
    let height = BLOCK_HEIGHT.with(|h| *h.borrow().get());
    
    // Calculate the next height FIRST, BEFORE making the block
    let next_height = height + 1;

    // Check if mining is complete first
    let current_reward = calculate_block_reward(next_height);
    if is_mining_complete(current_reward) {
        return Err("Mining is complete. No new blocks can be generated.".to_string());
    }

    // For blocks after 0, verify caller is a registered active miner
    if height > 0 {
        let caller = ic_cdk::caller();
        let is_active_miner = crate::MINERS_MAP.with(|miners| {
            miners
                .borrow()
                .get(&crate::StorablePrincipal(caller))
                .map(|info| matches!(info.status, crate::MinerStatus::Active))
                .unwrap_or(false)
        });

        if !is_active_miner {
            return Err("Only registered active miners can generate blocks after block 0".to_string());
        }
    }

    // Get previous block hash
    let prev_hash = LAST_BLOCK_HASH.with(|h| h.borrow().get().0);

    // Get current difficulty and adjust if needed
    let old_difficulty = MINING_DIFFICULTY.with(|d| *d.borrow().get());
    let new_difficulty = adjust_difficulty_asert();

    // ALWAYS update difficulty to ensure consistency
    MINING_DIFFICULTY.with(|d| {
        d.borrow_mut().set(new_difficulty).expect("Failed to update difficulty");
    });

    // Check if this will be the final block (next one would have zero reward)
    let next_reward = calculate_block_reward(next_height + 1);
    let is_final_block =
        next_reward == 0 || next_reward <= crate::TOKEN_INFO_CELL.with(|t| t.borrow().get().as_ref().map_or(0, |info| info.transfer_fee));

    // Generate events for this block
    let mut events = generate_events(next_height, old_difficulty, new_difficulty);

    // Add special final block event if needed
    if is_final_block {
        let supply = crate::CIRCULATING_SUPPLY_CELL.with(|s| *s.borrow().get());
        let total = crate::TOKEN_INFO_CELL.with(|t| t.borrow().get().as_ref().map_or(0, |info| info.total_supply));
        let percentage = if total > 0 { (supply as f64 / total as f64) * 100.0 } else { 0.0 };

        events.push(Event {
            event_type: EventType::SystemAnnouncement {
                message: format!(
                    "This is the final mining block. Mining complete at height {}. Total supply: {}/{} ({:.2}%)",
                    next_height, supply, total, percentage
                ),
                severity: "important".to_string(),
            },
            timestamp: ic_cdk::api::time() / 1_000_000_000,
            block_height: next_height,
        });
    }

    // Create new block template with NEXT height
    let block = BlockTemplate::new(
        next_height, // USE THE NEXT HEIGHT
        prev_hash,
        events,
        new_difficulty,
    );

    // Verify consistency
    if block.difficulty != new_difficulty {
        // Force consistency
        let mut fixed_block = block.clone();
        fixed_block.difficulty = new_difficulty;
        fixed_block.target = BlockTemplate::calculate_target(new_difficulty);

        // Store fixed block
        CURRENT_BLOCK.with(|b| {
            b.borrow_mut().set(Some(fixed_block.clone())).expect("Failed to set current block");
        });

        // AFTER storing the block, actually update the counter to match
        BLOCK_HEIGHT.with(|h| {
            h.borrow_mut().set(next_height).expect("Failed to update block height");
        });
        
        Ok(fixed_block)
    } else {
        // Store as current block
        CURRENT_BLOCK.with(|b| {
            b.borrow_mut().set(Some(block.clone())).expect("Failed to set current block");
        });

        // AFTER storing the block, actually update the counter to match
        BLOCK_HEIGHT.with(|h| {
            h.borrow_mut().set(next_height).expect("Failed to update block height");
        });
        
        Ok(block)
    }
}

async fn transfer_to_miner(ledger_id: Principal, miner: Principal, reward: u64) -> Result<(), String> {
    let transfer_args = TransferArg {
        from_subaccount: None,
        to: Account {
            owner: miner,
            subaccount: None,
        },
        amount: Nat::from(reward),
        fee: None,
        memo: None,
        created_at_time: None,
    };

    let _result = call(ledger_id, "icrc1_transfer", (transfer_args,))
        .await
        .map_err(|(code, msg)| format!("Transfer call failed: {} (code: {:?})", msg, code))?;

    Ok(())
}

fn check_rate_limit(miner: Principal) -> Result<(), String> {
    MINER_RATE_LIMITS.with(|limits| {
        let mut limits = limits.borrow_mut();
        let mut rate_limits = limits.get().0.clone();

        let now = ic_cdk::api::time();
        let rate_limit = rate_limits.entry(miner).or_insert_with(MinerRateLimit::default);

        // Reset counter if 30 seconds has passed
        // per 60 seconds gets too defensive too quickly for fast block times
        if now - rate_limit.last_submission >= 30_000_000_000 {
            // 30 seconds in nanoseconds
            rate_limit.submission_count = 0;
            rate_limit.last_submission = now;
        }

        // Check if rate limit exceeded
        if rate_limit.submission_count >= rate_limit.submissions_per_minute {
            return Err("Rate limit exceeded. Please wait before submitting more solutions.".to_string());
        }

        // Update counters
        rate_limit.submission_count += 1;
        rate_limit.last_submission = now;

        // Save updated limits
        limits.set(StorableRateLimits(rate_limits)).expect("Failed to update rate limits");

        Ok(())
    })
}

/// Allows miners to check if they can submit a solution before attempting submission
/// Returns Ok(true) if submission is allowed, Ok(false) if rate limited, or Err for other errors
#[ic_cdk::query]
pub fn can_submit_solution() -> Result<bool, String> {
    let miner = ic_cdk::caller();

    MINER_RATE_LIMITS.with(|limits| {
        let limits = limits.borrow();
        let rate_limits = limits.get().0.clone();

        let now = ic_cdk::api::time();

        // If miner not in rate limits yet, they can submit
        if !rate_limits.contains_key(&miner) {
            return Ok(true);
        }

        let rate_limit = rate_limits.get(&miner).unwrap();

        // Check if we should reset counter due to time elapsed
        if now - rate_limit.last_submission >= 30_000_000_000 {
            // 30 seconds in nanoseconds
            return Ok(true);
        }

        // Check if rate limit would be exceeded
        if rate_limit.submission_count >= rate_limit.submissions_per_minute {
            return Ok(false);
        }

        Ok(true)
    })
}

#[ic_cdk::query]
pub fn get_block_height() -> u64 {
    BLOCK_HEIGHT.with(|h| *h.borrow().get())
}

#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
struct MinerStats {
    blocks_mined: u64,
    total_rewards: u64,
    first_block_timestamp: Option<u64>,
    last_block_timestamp: Option<u64>,
    // Add new fields for better stats
    total_hashes_processed: u64,
    current_hashrate: f64,
    average_hashrate: f64,
    best_hashrate: f64,
    last_hashrate_update: u64,
    hashrate_samples: Vec<(u64, f64)>, // (timestamp, hashrate) pairs for moving average
}

impl Default for MinerStats {
    fn default() -> Self {
        Self {
            blocks_mined: 0,
            total_rewards: 0,
            first_block_timestamp: None,
            last_block_timestamp: None,
            total_hashes_processed: 0,
            current_hashrate: 0.0,
            average_hashrate: 0.0,
            best_hashrate: 0.0,
            last_hashrate_update: 0,
            hashrate_samples: Vec::new(),
        }
    }
}

// Add function to update hashrate
fn update_miner_hashrate(miner: Principal, hashes_processed: u64) {
    crate::MINERS.with(|miners| {
        let mut miners = miners.borrow_mut();
        if let Some(info) = miners.get(&miner).cloned() {
            let mut info = info; // Now we own the value
            let now = ic_cdk::api::time() / 1_000_000_000; // Convert to seconds

            // Update total hashes
            info.stats.total_hashes_processed += hashes_processed;

            // Calculate current hashrate
            if let Some(last_timestamp) = info.stats.last_hashrate_update {
                let time_diff = now - last_timestamp;
                if time_diff > 0 {
                    let current_rate = hashes_processed as f64 / time_diff as f64;
                    info.stats.current_hashrate = current_rate;

                    // Update best hashrate if current is better
                    if current_rate > info.stats.best_hashrate {
                        info.stats.best_hashrate = current_rate;
                    }

                    // Add to samples for moving average
                    info.stats.hashrate_samples.push((now, current_rate));

                    // Keep only last 10 samples
                    if info.stats.hashrate_samples.len() > 10 {
                        info.stats.hashrate_samples.remove(0);
                    }

                    // Calculate moving average
                    let total_rate: f64 = info.stats.hashrate_samples.iter().map(|(_, rate)| rate).sum();
                    info.stats.average_hashrate = total_rate / info.stats.hashrate_samples.len() as f64;
                }
            }

            info.stats.last_hashrate_update = Some(now);
            miners.insert(miner, info);
        }
    });
}

// Constants for cycle management
const REQUIRED_SUBMISSION_CYCLES: u128 = 420_690; // Required cycles per submission

// Add a function to create a BlockMined event
fn create_block_mined_event(miner: Principal, reward: u64, nonce: u64, hash: Hash, height: u64) -> Event {
    let current_time = ic_cdk::api::time() / 1_000_000_000; // Convert to seconds
    Event {
        event_type: EventType::BlockMined {
            miner,
            reward,
            nonce,
            hash,
        },
        timestamp: current_time,
        block_height: height,
    }
}

#[ic_cdk::update]
pub async fn submit_solution(
    ledger_id: Principal,
    nonce: u64,
    solution_hash: Hash,
    hashes_processed: u64,
) -> Result<(bool, u64, u64, String), String> {
    // Check if ledger is deployed
    let stored_ledger_id = crate::LEDGER_ID_CELL.with(|id| id.borrow().get().as_ref().map(|p| p.0));

    if stored_ledger_id.is_none() {
        return Err("Mining not available: Ledger has not been deployed yet".to_string());
    }

    // Verify the provided ledger ID matches the stored one
    if stored_ledger_id != Some(ledger_id) {
        return Err(format!(
            "Invalid ledger ID. Expected: {}, Got: {}",
            stored_ledger_id.unwrap().to_text(),
            ledger_id.to_text()
        ));
    }

    // Check if genesis block has been generated
    let genesis_generated = GENESIS_BLOCK_GENERATED.with(|g| *g.borrow().get());
    if !genesis_generated {
        return Err("Mining not available: Genesis block has not been generated yet".to_string());
    }

    // Check if mining is complete first
    let current_height = BLOCK_HEIGHT.with(|h| *h.borrow().get());
    let current_reward = calculate_block_reward(current_height);
    if is_mining_complete(current_reward) {
        return Err("Mining is complete. Token has reached its maximum supply or minimum reward threshold.".to_string());
    }

    // First verify cycles payment
    let available_cycles = ic_cdk::api::call::msg_cycles_available128();
    if available_cycles < REQUIRED_SUBMISSION_CYCLES {
        return Err("Insufficient cycles attached. 25,000 cycles required per submission.".to_string());
    }

    // Accept exactly the required cycles
    let accepted = ic_cdk::api::call::msg_cycles_accept128(REQUIRED_SUBMISSION_CYCLES);
    if accepted < REQUIRED_SUBMISSION_CYCLES {
        return Err("Failed to accept cycles. Please try again.".to_string());
    }

    // Update total cycles earned
    TOTAL_CYCLES_EARNED.with(|total| {
        let current = *total.borrow().get();
        total.borrow_mut().set(current + accepted).expect("Failed to update total cycles");
    });

    // Cool, got payment for self sustainability, now let's process the solution
    // check if the module hash of caller is one of our miner versions

    let caller = ic_cdk::caller();

    // Update hashrate first
    update_miner_hashrate(caller, hashes_processed);

    // Check rate limit first
    check_rate_limit(caller)?;

    // Get current block
    let current_block = CURRENT_BLOCK.with(|b| b.borrow().get().clone().ok_or("No block template available".to_string()))?;

    // Store the height of the block being mined
    let mined_height = current_block.height;

    // Create solution object for checking
    let solution = StorableSolution {
        nonce,
        hash: solution_hash,
        block_height: current_block.height,
        timestamp: ic_cdk::api::time(),
    };

    // First check bloom filter (fast negative check)
    let might_be_processed = SOLUTION_BLOOM_FILTER.with(|filter| {
        let bloom = filter.borrow().get().clone();
        bloom.might_contain(&solution)
    });

    // If bloom filter indicates it might be processed, do the full check
    if might_be_processed {
        let already_processed = PROCESSED_SOLUTIONS.with(|solutions| {
            solutions
                .borrow()
                .get()
                .0
                .iter()
                .any(|s| s.nonce == nonce && s.hash == solution_hash && s.block_height == current_block.height)
        });

        if already_processed {
            // Get token ticker
            let ticker =
                crate::TOKEN_INFO_CELL.with(|t| t.borrow().get().as_ref().map_or("UNKNOWN".to_string(), |info| info.ticker.clone()));
            return Ok((true, current_block.height, 0, ticker)); // No new reward for already processed solutions
        }
    }

    // Verify solution
    if !current_block.verify_solution(nonce, solution_hash) {
        // Get token ticker
        let ticker = crate::TOKEN_INFO_CELL.with(|t| t.borrow().get().as_ref().map_or("UNKNOWN".to_string(), |info| info.ticker.clone()));
        return Ok((false, current_block.height, 0, ticker));
    }

    // Add to bloom filter and processed solutions
    SOLUTION_BLOOM_FILTER.with(|filter| {
        let mut filter = filter.borrow_mut();
        let mut bloom = filter.get().clone();
        bloom.add(&solution);
        filter.set(bloom).expect("Failed to update bloom filter");
    });

    PROCESSED_SOLUTIONS.with(|solutions| {
        let mut sols = solutions.borrow().get().0.clone();
        // Keep only last 100 solutions to prevent unbounded growth
        if sols.len() >= 100 {
            sols.remove(0); // Remove oldest
        }
        sols.push(solution);
        solutions
            .borrow_mut()
            .set(StorableSolutions(sols))
            .expect("Failed to update processed solutions");
    });

    // Store block timestamp for ASERT
    BLOCK_TIMESTAMPS.with(|ts| {
        let mut timestamps = ts.borrow_mut();
        let mut data = timestamps.get().0.clone();
        // Keep only last 1000 timestamps to prevent unbounded growth
        if data.len() >= 1000 {
            data.remove(0); // Remove oldest
        }
        data.push(current_block.timestamp * 1_000_000_000); // Convert seconds to nanoseconds
        timestamps.set(StorableTimestamps(data)).expect("Failed to update block timestamps");
    });

    // Step 1: Update block hash
    LAST_BLOCK_HASH.with(|h| {
        h.borrow_mut()
            .set(StorableHash(solution_hash))
            .expect("Failed to update last block hash");
    });

    // Step 2: Process reward if applicable
    let reward = calculate_block_reward(mined_height);
    if reward > 0 {
        transfer_to_miner(ledger_id, caller, reward).await?;
        crate::update_circulating_supply(reward);
        crate::update_miner_stats(caller, reward);
        
        // Add a BlockMined event
        let block_mined_event = create_block_mined_event(caller, reward, nonce, solution_hash, mined_height);
        
        // Add to event batches
        if should_add_event_to_batch(mined_height) {
            add_event_to_batch(block_mined_event.clone());
        }
    }

    // Step 5: Generate new block
    match generate_new_block().await {
        Ok(_) => {
            // Get token ticker
            let ticker = crate::TOKEN_INFO_CELL.with(|t| t.borrow().get().as_ref().map_or("UNKNOWN".to_string(), |info| info.ticker.clone()));
            Ok((true, mined_height, reward, ticker))
        }
        Err(e) => Err(e)
    }
}

#[ic_cdk::query]
pub fn get_mining_difficulty() -> u32 {
    MINING_DIFFICULTY.with(|d| *d.borrow().get())
}

#[ic_cdk::query]
pub fn get_mining_info() -> MiningInfo {
    let difficulty = MINING_DIFFICULTY.with(|d| *d.borrow().get());
    let height = BLOCK_HEIGHT.with(|h| *h.borrow().get());
    let target = BLOCK_TIME_TARGET.with(|t| *t.borrow().get());
    let halving_interval = HALVING_INTERVAL.with(|h| *h.borrow().get());

    // Calculate next_halving, handling the case where halving_interval is 0
    let next_halving = if halving_interval == 0 {
        0 // No halving will occur when halving_interval is 0
    } else {
        halving_interval - (height % halving_interval)
    };

    // Calculate the current block reward
    let current_reward = calculate_block_reward(height);

    // Check if mining is complete
    // This occurs when either:
    // 1. The block reward becomes too small (less than transfer fee)
    // 2. We've reached the target supply
    let mining_complete = is_mining_complete(current_reward);

    MiningInfo {
        current_difficulty: difficulty,
        current_block_reward: current_reward,
        block_time_target: target,
        next_halving_interval: next_halving,
        mining_complete,
    }
}

/// Determines if mining is effectively complete based on current conditions
fn is_mining_complete(current_reward: u64) -> bool {
    // Get current circulating supply
    let supply = crate::CIRCULATING_SUPPLY_CELL.with(|s| *s.borrow().get());

    // Get total supply from token info
    let total_supply = crate::TOKEN_INFO_CELL.with(|t| t.borrow().get().as_ref().map_or(0, |info| info.total_supply));

    // Get transfer fee
    let transfer_fee = crate::TOKEN_INFO_CELL.with(|t| t.borrow().get().as_ref().map_or(0, |info| info.transfer_fee));

    // Mining is complete if:
    // 1. Reward is zero or less than transfer fee (not economically viable)
    // 2. We've mined 99.99% of total supply
    let reward_too_small = current_reward == 0 || current_reward <= transfer_fee;
    let supply_nearly_complete = total_supply > 0 && ((total_supply - supply) * 10000 / total_supply) < 1; // Less than 0.01% remaining

    reward_too_small || supply_nearly_complete
}

// Add query method to get total cycles earned
#[ic_cdk::query]
pub fn get_total_cycles_earned() -> u128 {
    TOTAL_CYCLES_EARNED.with(|total| *total.borrow().get())
}

// Add query to get current block time target
#[ic_cdk::query]
pub fn get_block_time_target() -> u64 {
    BLOCK_TIME_TARGET.with(|t| *t.borrow().get())
}

/// Updates the current block template with any needed difficulty adjustments
/// Returns true if the template was updated
pub fn update_block_template() -> bool {
    let now = ic_cdk::api::time() / 1_000_000_000;
    let last_timestamp = BLOCK_TIMESTAMPS.with(|ts| {
        let data = ts.borrow().get().0.clone();
        if data.is_empty() {
            now
        } else {
            data[data.len() - 1] / 1_000_000_000
        }
    });

    let time_since_last = now.saturating_sub(last_timestamp);
    let target_time = BLOCK_TIME_TARGET.with(|t| *t.borrow().get());

    // Only start counting heartbeats after we've passed target time
    if time_since_last > target_time {
        // Get time since target was exceeded
        let excess_time = time_since_last - target_time;

        // Use the safeguarded heartbeat calculation
        let heartbeat_interval = calculate_heartbeat_interval();

        // Only increment counter every heartbeat_interval seconds after target time
        let mut should_decrease = false;
        if excess_time % heartbeat_interval == 0 {
            HEARTBEAT_COUNTER.with(|counter| {
                let mut count = counter.borrow_mut();
                *count += 1;
                if *count >= 5 { // Reduced from 10 to 5 for faster response
                    should_decrease = true;
                    *count = 0;
                }
            });
        }

        let current_diff = MINING_DIFFICULTY.with(|d| *d.borrow().get());

        // If we've hit the required heartbeats, decrease difficulty more aggressively
        if should_decrease && current_diff > 5 { // Changed from 16 to 5 to allow lower difficulty
            let new_diff = current_diff - (current_diff * 15 / 100); // Increased from 5% to 15% for more aggressive reduction
            MINING_DIFFICULTY.with(|d| {
                d.borrow_mut().set(new_diff).expect("Failed to update difficulty");
            });

            CURRENT_BLOCK.with(|b| {
                let current_opt = b.borrow().get().clone();

                if let Some(mut current) = current_opt {
                    current.difficulty = new_diff;
                    current.target = BlockTemplate::calculate_target(new_diff);
                    b.borrow_mut().set(Some(current.clone())).expect("Failed to update block");
                }
            });
            true
        } else {
            false
        }
    } else {
        false
    }
}

#[ic_cdk::query]
pub fn get_recent_events_from_batches(limit: Option<u32>) -> Vec<Event> {
    let limit = limit.unwrap_or(50) as usize;

    EVENT_BATCHES.with(|batches| {
        let all_batches = batches.borrow().get().0.clone();
        let mut events = Vec::new();

        // Iterate through batches in reverse to get most recent events
        for batch in all_batches.iter().rev() {
            for event in batch.events.iter() {
                events.push(event.clone());
                if events.len() >= limit {
                    return events;
                }
            }
        }

        events
    })
}

#[derive(CandidType, Serialize, Deserialize)]
pub enum BlockTimeResult {
    Ok(f64), // Average block time in seconds
    Err(String),
}

#[ic_cdk::query]
pub fn get_average_block_time(window_size: Option<u32>) -> BlockTimeResult {
    BLOCK_TIMESTAMPS.with(|ts| {
        let timestamps = ts.borrow().get().0.clone();

        if timestamps.len() < 2 {
            return BlockTimeResult::Err("Not enough blocks to calculate average".to_string());
        }

        let window = window_size.unwrap_or(100) as usize;
        let start_idx = if timestamps.len() > window { timestamps.len() - window } else { 0 };

        let mut total_diff = 0u64;
        let mut count = 0;

        for i in start_idx + 1..timestamps.len() {
            let diff = timestamps[i] - timestamps[i - 1];
            total_diff += diff;
            count += 1;
        }

        if count == 0 {
            return BlockTimeResult::Err("No block time differences to average".to_string());
        }

        // Convert from nanoseconds to seconds and return as float
        let avg_ns = total_diff as f64 / count as f64;
        BlockTimeResult::Ok(avg_ns / 1_000_000_000.0)
    })
}

pub fn initialize_memory() {
    // Initialize memory manager and all buckets
    MEMORY_MANAGER.with(|m| {
        let manager = m.borrow_mut();
        // Pre-allocate all memory buckets
        for i in 8..=21 {
            manager.get(MemoryId::new(i));
        }
    });

    // Check if mining parameters are reset (set to 0) and reinitialize them if needed
    let difficulty = MINING_DIFFICULTY.with(|d| *d.borrow().get());
    let block_time_target = BLOCK_TIME_TARGET.with(|t| *t.borrow().get());
    let halving_interval = HALVING_INTERVAL.with(|h| *h.borrow().get());
    let block_reward = BLOCK_REWARD.with(|r| *r.borrow().get());

    // If any of the critical mining parameters are 0, reinitialize with default values
    if difficulty == 0 || block_time_target == 0 || halving_interval == 0 || block_reward == 0 {
        ic_cdk::println!("Critical mining parameters were reset during upgrade. Restoring defaults.");

        // Default values (adjust these based on your token's requirements)
        let default_difficulty = if difficulty == 0 { 10 } else { difficulty };
        let default_block_time = if block_time_target == 0 { 60 } else { block_time_target }; // 60 seconds
        let default_halving = if halving_interval == 0 { 210000 } else { halving_interval }; // 210,000 blocks
        let default_reward = if block_reward == 0 { 50 * 100000000 } else { block_reward }; // 50 tokens with 8 decimals

        // Restore the parameters
        MINING_DIFFICULTY.with(|d| {
            d.borrow_mut().set(default_difficulty).expect("Failed to restore mining difficulty");
        });

        BLOCK_TIME_TARGET.with(|t| {
            t.borrow_mut().set(default_block_time).expect("Failed to restore block time target");
        });

        HALVING_INTERVAL.with(|h| {
            h.borrow_mut().set(default_halving).expect("Failed to restore halving interval");
        });

        BLOCK_REWARD.with(|r| {
            r.borrow_mut().set(default_reward).expect("Failed to restore block reward");
        });
    }

    // Check if current block is available
    let current_block = CURRENT_BLOCK.with(|b| b.borrow().get().clone());
    let genesis_generated = GENESIS_BLOCK_GENERATED.with(|g| *g.borrow().get());
    let ledger_deployed = crate::LEDGER_ID_CELL.with(|id| id.borrow().get().is_some());

    // Log the current state
    ic_cdk::println!(
        "Post-upgrade mining state: ledger_deployed={}, genesis_generated={}, current_block={}",
        ledger_deployed,
        genesis_generated,
        current_block.is_some()
    );

    // If ledger is deployed and genesis block is generated but no current block,
    // we need to update the block template
    if ledger_deployed && genesis_generated && current_block.is_none() {
        ic_cdk::println!("Ledger is deployed and genesis block is generated, but no current block. Updating block template...");
        update_block_template();

        // Check if block template was updated
        let updated_block = CURRENT_BLOCK.with(|b| b.borrow().get().clone());
        if updated_block.is_some() {
            ic_cdk::println!("Block template updated successfully after upgrade");
        } else {
            ic_cdk::println!("Warning: Failed to update block template after upgrade");
        }
    }
}

fn calculate_heartbeat_interval() -> u64 {
    let target_time = BLOCK_TIME_TARGET.with(|t| *t.borrow().get());
    let heartbeat_interval = if target_time < 10 {
        1 // Minimum 1 second interval
    } else {
        target_time / 10
    };
    heartbeat_interval.max(1) // Final safety net
}

fn is_genesis_already_generated() -> Result<(), String> {
    let current_block_exists = CURRENT_BLOCK.with(|b| b.borrow().get().is_some());
    if current_block_exists {
        return Err("Genesis block has already been generated. A block template already exists.".to_string());
    }
    
    // Check block height - if greater than 0, we've clearly generated blocks
    let height = BLOCK_HEIGHT.with(|h| *h.borrow().get());
    if height > 0 {
        return Err(format!(
            "Genesis block has already been generated. Current block height is {}",
            height
        ));
    }

    Ok(())
}

// update
#[ic_cdk::update]
pub async fn create_genesis_block() -> Result<BlockTemplate, String> {
    // Check if caller is the controller
    let caller = ic_cdk::caller();
    let is_controller = ic_cdk::api::is_controller(&caller);

    if !is_controller {
        return Err("Only the controller can create the genesis block".to_string());
    }

    // Check if genesis block has already been generated using multiple verification methods
    is_genesis_already_generated()?;

    // Generate the genesis block
    let result = generate_new_block().await;

    // If successful, set the genesis flag
    if result.is_ok() {
        GENESIS_BLOCK_GENERATED.with(|g| {
            g.borrow_mut().set(true).expect("Failed to set genesis block generated flag");
        });

        ic_cdk::println!("Genesis block successfully generated and flag set");
    }

    result
}

#[ic_cdk::update]
pub fn restore_mining_params(
    block_reward: u64,
    mining_difficulty: u32,
    block_time_target: u64,
    halving_interval: u64,
) -> Result<(), String> {
    // Check if caller is a controller
    let caller = ic_cdk::caller();
    let is_controller = ic_cdk::api::is_controller(&caller);

    if !is_controller {
        return Err("Only the controller can restore mining parameters".to_string());
    }

    // Restore the parameters
    MINING_DIFFICULTY.with(|d| {
        d.borrow_mut().set(mining_difficulty).expect("Failed to restore mining difficulty");
    });

    BLOCK_TIME_TARGET.with(|t| {
        t.borrow_mut().set(block_time_target).expect("Failed to restore block time target");
    });

    HALVING_INTERVAL.with(|h| {
        h.borrow_mut().set(halving_interval).expect("Failed to restore halving interval");
    });

    BLOCK_REWARD.with(|r| {
        r.borrow_mut().set(block_reward).expect("Failed to restore block reward");
    });

    ic_cdk::println!(
        "Mining parameters manually restored: difficulty={}, block_time={}, halving_interval={}, block_reward={}",
        mining_difficulty,
        block_time_target,
        halving_interval,
        block_reward
    );

    Ok(())
}

#[ic_cdk::query]
pub fn is_mining_ready() -> Result<bool, String> {
    // Check if ledger is deployed
    let ledger_deployed = crate::LEDGER_ID_CELL.with(|id| id.borrow().get().is_some());
    if !ledger_deployed {
        return Err("Mining not ready: Ledger has not been deployed yet".to_string());
    }

    // Check if genesis block has been generated
    let genesis_generated = GENESIS_BLOCK_GENERATED.with(|g| *g.borrow().get());
    if !genesis_generated {
        return Err("Mining not ready: Genesis block has not been generated yet".to_string());
    }

    // Check if current block is available
    let current_block = CURRENT_BLOCK.with(|b| b.borrow().get().clone());
    if current_block.is_none() {
        return Err("Mining not ready: No block template available".to_string());
    }

    // Check if mining is complete
    let current_height = BLOCK_HEIGHT.with(|h| *h.borrow().get());
    let current_reward = calculate_block_reward(current_height);
    if is_mining_complete(current_reward) {
        return Err("Mining is complete. Token has reached its maximum supply or minimum reward threshold.".to_string());
    }

    Ok(true)
}

#[ic_cdk::query]
pub fn is_genesis_block_generated() -> bool {
    GENESIS_BLOCK_GENERATED.with(|g| *g.borrow().get())
}
