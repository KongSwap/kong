// src/token_backend/src/mining.rs

use candid::{CandidType, Deserialize};
use ciborium;
use ic_stable_structures::storable::Bound;
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl, StableCell, Storable,
};
use lru::LruCache;
use serde::Serialize;
use std::borrow::Cow;
use std::cell::RefCell;
use std::num::NonZeroUsize;

use crate::block_templates::{BlockTemplate, Hash};

type Memory = VirtualMemory<DefaultMemoryImpl>;

#[ic_cdk::query]
pub fn mining_version() -> String {
    "v1".to_string()
}

#[derive(Debug, Clone)]
pub(crate) struct StorableTimestamps(pub(crate) Vec<u64>);

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
        max_size: 1024 * 8, // Approx 1024 timestamps
        is_fixed_size: false,
    };
}

// Create a newtype wrapper for Hash to implement Storable
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) struct StorableHash(pub(crate) Hash);

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
pub(crate) struct StorableSolution {
    pub(crate) nonce: u64,
    pub(crate) hash: Hash,
    pub(crate) block_height: u64,
    pub(crate) timestamp: u64,
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
pub(crate) struct StorableSolutions(pub(crate) Vec<StorableSolution>);

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
pub(crate) struct BloomFilter {
    data: [u8; 1024], // 8192 bits
    k: u32,           // Number of hash functions
}

impl BloomFilter {
    fn new() -> Self {
        Self { data: [0; 1024], k: 3 }
    }

    // Simple DJB2 hash variation
    fn hash(&self, data: &[u8], seed: u32) -> usize {
        let mut hash: u64 = 5381_u64.wrapping_add(seed as u64);
        for &byte in data {
            hash = ((hash << 5).wrapping_add(hash)).wrapping_add(byte as u64);
        }
        (hash % (self.data.len() * 8) as u64) as usize
    }

    pub(crate) fn add(&mut self, solution: &StorableSolution) {
        let mut data = Vec::with_capacity(48); // nonce (8) + hash (32) + block_height (8)
        data.extend_from_slice(&solution.nonce.to_le_bytes());
        data.extend_from_slice(&solution.hash);
        data.extend_from_slice(&solution.block_height.to_le_bytes());

        for i in 0..self.k {
            let pos = self.hash(&data, i);
            let byte_pos = pos / 8;
            let bit_pos = pos % 8;
            if byte_pos < self.data.len() {
                self.data[byte_pos] |= 1 << bit_pos;
            }
        }
    }

    pub(crate) fn might_contain(&self, solution: &StorableSolution) -> bool {
        let mut data = Vec::with_capacity(48);
        data.extend_from_slice(&solution.nonce.to_le_bytes());
        data.extend_from_slice(&solution.hash);
        data.extend_from_slice(&solution.block_height.to_le_bytes());

        for i in 0..self.k {
            let pos = self.hash(&data, i);
            let byte_pos = pos / 8;
            let bit_pos = pos % 8;
            if byte_pos >= self.data.len() || self.data[byte_pos] & (1 << bit_pos) == 0 {
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

// LRU cache for recent solution verifications (in-memory only)
thread_local! {
    static SOLUTION_CACHE: RefCell<LruCache<(u64, Hash), ()>> = RefCell::new(
        LruCache::new(NonZeroUsize::new(1000).unwrap())
    );
}

thread_local! {
    // Memory Manager
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
        MemoryManager::init(DefaultMemoryImpl::default())
    );

    // --- Mining State ---

    // Current block template being mined
    pub(crate) static CURRENT_BLOCK: RefCell<StableCell<Option<BlockTemplate>, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(6))), // ID 6
            None
        ).expect("Failed to init CURRENT_BLOCK")
    );

    // Hash of the previously mined block
    pub(crate) static LAST_BLOCK_HASH: RefCell<StableCell<StorableHash, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(7))), // ID 7
            StorableHash([0; 32])
        ).expect("Failed to init LAST_BLOCK_HASH")
    );

    // Current block height (number of blocks mined so far)
    pub(crate) static BLOCK_HEIGHT: RefCell<StableCell<u64, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(8))), // ID 8
            0
        ).expect("Failed to init BLOCK_HEIGHT")
    );

    // Current mining difficulty target
    pub(crate) static MINING_DIFFICULTY: RefCell<StableCell<u32, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(9))), // ID 9
            0 // Initialized properly in init_mining_params or post_upgrade
        ).expect("Failed to init MINING_DIFFICULTY")
    );

    // Initial block reward (halves over time)
    pub(crate) static BLOCK_REWARD: RefCell<StableCell<u64, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(10))), // ID 10
            0
        ).expect("Failed to init BLOCK_REWARD")
    );

    // Target time between blocks (in seconds)
    pub(crate) static BLOCK_TIME_TARGET: RefCell<StableCell<u64, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(11))), // ID 11
            0
        ).expect("Failed to init BLOCK_TIME_TARGET")
    );

    // Recent block timestamps (for difficulty adjustment)
    pub(crate) static BLOCK_TIMESTAMPS: RefCell<StableCell<StorableTimestamps, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(12))), // ID 12
            StorableTimestamps(Vec::new())
        ).expect("Failed to init BLOCK_TIMESTAMPS")
    );

    // Recently processed unique solutions (nonce, hash, height) to prevent duplicates
    pub(crate) static PROCESSED_SOLUTIONS: RefCell<StableCell<StorableSolutions, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(13))), // ID 13
            StorableSolutions(Vec::new())
        ).expect("Failed to init PROCESSED_SOLUTIONS")
    );

    // Bloom filter for quick check against processed solutions
    pub(crate) static SOLUTION_BLOOM_FILTER: RefCell<StableCell<BloomFilter, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(14))), // ID 14
            BloomFilter::new()
        ).expect("Failed to init SOLUTION_BLOOM_FILTER")
    );

    // Number of blocks after which the reward halves
    // IMPORTANT: Assign a unique MemoryId, e.g., 16, instead of reusing 14.
    pub(crate) static HALVING_INTERVAL: RefCell<StableCell<u64, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(16))), // Changed to ID 16
            0
        ).expect("Failed to init HALVING_INTERVAL")
    );

    // Flag indicating if the genesis block (block 1) has been created
    pub(crate) static GENESIS_BLOCK_GENERATED: RefCell<StableCell<bool, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(24))), // ID 24
            false
        ).expect("Failed to init GENESIS_BLOCK_GENERATED")
    );

    // --- In-Memory State (Lost on Upgrade) ---

    // Counter for heartbeat mechanism (difficulty reduction when stalled)
    pub(crate) static HEARTBEAT_COUNTER: RefCell<u32> = RefCell::new(0);
}

/// Initialize mining parameters. Called once during initial canister deployment.
pub fn init_mining_params(initial_block_reward: u64, block_time_target: u64, halving_interval: u64) {
    const INITIAL_DIFFICULTY: u32 = 10; // Set a reasonable starting difficulty

    BLOCK_REWARD.with(|r| {
        r.borrow_mut().set(initial_block_reward).expect("Failed to set block reward");
    });

    MINING_DIFFICULTY.with(|d| {
        d.borrow_mut().set(INITIAL_DIFFICULTY).expect("Failed to set mining difficulty");
    });

    BLOCK_TIME_TARGET.with(|t| {
        t.borrow_mut().set(block_time_target).expect("Failed to set block time target");
    });

    // Set halving interval (using ID 16 now)
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

     // Initialize Genesis Flag to false
    GENESIS_BLOCK_GENERATED.with(|g| {
        g.borrow_mut().set(false).expect("Failed to init genesis flag");
    });

    ic_cdk::println!(
        "Mining params initialized: Reward={}, TargetTime={}, Halving={}, Difficulty={}",
        initial_block_reward, block_time_target, halving_interval, INITIAL_DIFFICULTY
    );
}

// --- Difficulty Adjustment (Simplified) ---

/// Adjusts mining difficulty based on the time of the last block relative to the target.
/// Clamps the adjustment factor to prevent excessive swings.
fn adjust_difficulty() -> u32 {
    const MIN_DIFFICULTY: u32 = 5;           // Minimum difficulty floor
    const MAX_ADJUSTMENT_FACTOR: f64 = 1.25; // Max 25% increase per block
    const MIN_ADJUSTMENT_FACTOR: f64 = 0.75; // Max 25% decrease per block
    // Optional: Define a maximum difficulty ceiling if needed
    // const MAX_DIFFICULTY: u32 = 100_000;

    let target_time_sec = BLOCK_TIME_TARGET.with(|t| *t.borrow().get());
    let current_diff = MINING_DIFFICULTY.with(|d| *d.borrow().get());

    // Get timestamp of the last block (in seconds)
    let last_timestamp_sec = BLOCK_TIMESTAMPS.with(|ts| {
        let data = ts.borrow().get().0.clone();
        data.last().map(|ns| ns / 1_000_000_000)
    });

    // If no previous block timestamp, or target time is 0, return current difficulty (or minimum)
    let last_timestamp_sec = match last_timestamp_sec {
        Some(ts) if target_time_sec > 0 => ts,
        _ => return current_diff.max(MIN_DIFFICULTY), // No adjustment if no history or invalid target
    };

    let now_sec = ic_cdk::api::time() / 1_000_000_000;
    let actual_time_sec = now_sec.saturating_sub(last_timestamp_sec);

    // Avoid division by zero or extreme adjustments for very fast blocks (<1s)
    if actual_time_sec == 0 {
        return current_diff.max(MIN_DIFFICULTY); // No adjustment for zero time diff
    }

    // Calculate the basic adjustment factor: (Target Time / Actual Time)
    let adjustment_factor = target_time_sec as f64 / actual_time_sec as f64;

    // Clamp the adjustment factor to prevent excessive swings
    let clamped_factor = adjustment_factor.clamp(MIN_ADJUSTMENT_FACTOR, MAX_ADJUSTMENT_FACTOR);

    // Calculate new difficulty
    let new_diff_f64 = current_diff as f64 * clamped_factor;

    // Clamp to minimum difficulty and convert to u32, ensuring finite value
    let new_diff = if new_diff_f64.is_finite() {
        (new_diff_f64.round() as u32).max(MIN_DIFFICULTY) // Round before casting
    } else {
        ic_cdk::println!("Warning: Difficulty calculation resulted in non-finite number. Factor: {}, Current Diff: {}", clamped_factor, current_diff);
        current_diff.max(MIN_DIFFICULTY) // Fallback
    };

    new_diff
}

// --- Block Generation & Submission ---

#[ic_cdk::query]
pub fn get_current_block() -> Option<BlockTemplate> {
    let ledger_deployed = crate::LEDGER_ID_CELL.with(|id| id.borrow().get().is_some());
    let genesis_generated = GENESIS_BLOCK_GENERATED.with(|g| *g.borrow().get());
    let current_block = CURRENT_BLOCK.with(|b| b.borrow().get().clone());

    if current_block.is_none() {
        let reason = if !ledger_deployed {
            "ledger not deployed"
        } else if !genesis_generated {
            "genesis block not generated"
        } else {
            "no block template available (likely needs next solution)"
        };
        ic_cdk::println!("Warning: get_current_block called but {}", reason);
    }

    current_block
}

/// Calculates the block reward for a given block height based on halving interval.
pub(crate) fn calculate_block_reward(block_height: u64) -> u64 {
    let initial_reward = BLOCK_REWARD.with(|r| *r.borrow().get());
    let halving_interval = HALVING_INTERVAL.with(|h| *h.borrow().get());

    if initial_reward == 0 {
        return 0; // If initial reward is zero, reward is always zero
    }

    // If halving_interval is 0, use continuous emission (always same reward)
    if halving_interval == 0 {
        return initial_reward;
    }

    // Calculate number of halvings that have occurred (use height - 1 because block 1 is the first)
    let halvings = if block_height > 0 {
        (block_height - 1) / halving_interval
    } else {
        0 // No halvings before block 1
    };

    // After 64 halvings reward becomes 0 effectively
    if halvings >= 64 {
        0
    } else {
        initial_reward >> halvings // Bit shift right = divide by 2^halvings
    }
}

/// Generates a new block template. Called after a solution is found or during genesis creation.
/// Requires caller check for genesis block generation.
pub async fn generate_new_block() -> Result<BlockTemplate, String> {
    let height = BLOCK_HEIGHT.with(|h| *h.borrow().get());
    let next_height = height + 1;

    // Miner check: Only registered active miners can *trigger* new block generation *after* genesis
    // The genesis block creation is triggered by the controller via `create_genesis_block`.
    if height > 0 {
        let caller = ic_cdk::caller();
        let is_active_miner = crate::MINERS_MAP.with(|miners| {
            miners
                .borrow()
                .get(&crate::StorablePrincipal(caller))
                .map(|info| matches!(info.status, crate::MinerStatus::Active))
                .unwrap_or(false)
        });

        // Also allow the canister itself (for heartbeat/post-upgrade checks if implemented)
        if !is_active_miner && caller != ic_cdk::api::id() {
            return Err("Only registered active miners can trigger new block generation after genesis.".to_string());
        }
    }

    // Get previous block hash (will be zeros for genesis)
    let prev_hash = LAST_BLOCK_HASH.with(|h| h.borrow().get().0);

    // Adjust difficulty based on previous block time
    let new_difficulty = adjust_difficulty();

    // Update stable memory with the calculated difficulty *before* creating the block
    MINING_DIFFICULTY.with(|d| {
        d.borrow_mut().set(new_difficulty).expect("Failed to update difficulty");
    });

    // Create new block template
    let block = BlockTemplate::new(
        next_height, // Use the calculated next height
        prev_hash,
        new_difficulty,
    );

    // Sanity check: Ensure block's difficulty matches the set difficulty
    if block.difficulty != new_difficulty {
         ic_cdk::println!(
            "CRITICAL WARNING: Block difficulty mismatch after creation! Expected {}, got {}. Forcing consistency.",
            new_difficulty, block.difficulty
        );
        let mut fixed_block = block.clone();
        fixed_block.difficulty = new_difficulty;
        fixed_block.target = BlockTemplate::calculate_target(new_difficulty); // Recalculate target too

        CURRENT_BLOCK.with(|b| {
            b.borrow_mut().set(Some(fixed_block.clone())).expect("Failed to set fixed current block");
        });
        BLOCK_HEIGHT.with(|h| {
            h.borrow_mut().set(next_height).expect("Failed to update block height for fixed block");
        });
        Ok(fixed_block)
    } else {
        CURRENT_BLOCK.with(|b| {
            b.borrow_mut().set(Some(block.clone())).expect("Failed to set current block");
        });
        BLOCK_HEIGHT.with(|h| {
            h.borrow_mut().set(next_height).expect("Failed to update block height");
        });
        Ok(block)
    }
}

/// Calculates the expected heartbeat interval based on block time target.
fn calculate_heartbeat_interval() -> u64 {
    let target_time = BLOCK_TIME_TARGET.with(|t| *t.borrow().get());
    if target_time == 0 { return 6; }
    (target_time / 10).clamp(1, 60)
}

/// Called periodically (e.g., by canister_heartbeat) to potentially lower difficulty
/// if no blocks have been mined for a while.
pub fn update_block_template_difficulty() -> bool {
     if !GENESIS_BLOCK_GENERATED.with(|g| *g.borrow().get()) || CURRENT_BLOCK.with(|b| b.borrow().get().is_none()) {
         return false;
     }

    let now_sec = ic_cdk::api::time() / 1_000_000_000;
    let last_timestamp_sec = match BLOCK_TIMESTAMPS.with(|ts| ts.borrow().get().0.last().map(|ns| ns / 1_000_000_000)) {
        Some(ts) => ts,
        None => return false,
    };

    let target_time_sec = BLOCK_TIME_TARGET.with(|t| *t.borrow().get());
    let time_since_last = now_sec.saturating_sub(last_timestamp_sec);

    if target_time_sec > 0 && time_since_last > target_time_sec {
        let heartbeat_interval = calculate_heartbeat_interval();
        let excess_time = time_since_last - target_time_sec;
        let mut should_decrease = false;

        if heartbeat_interval > 0 && excess_time > 0 && (excess_time % heartbeat_interval == 0 || excess_time == 1) {
            HEARTBEAT_COUNTER.with(|counter| {
                let mut count = counter.borrow_mut();
                *count += 1;
                const HEARTBEAT_THRESHOLD: u32 = 5;
                if *count >= HEARTBEAT_THRESHOLD {
                    should_decrease = true;
                    *count = 0;
                    ic_cdk::println!("Heartbeat threshold {} reached after {}s overdue.", HEARTBEAT_THRESHOLD, time_since_last);
                } else {
                    ic_cdk::println!("Heartbeat tick {}/{} ({}s overdue)", *count, HEARTBEAT_THRESHOLD, time_since_last);
                }
            });
        }

        if should_decrease {
            let current_diff = MINING_DIFFICULTY.with(|d| *d.borrow().get());
            const MIN_DIFFICULTY_FLOOR: u32 = 5;

            if current_diff > MIN_DIFFICULTY_FLOOR {
                let reduction_percentage = 15;
                let decrease_amount = ((current_diff as u64 * reduction_percentage / 100) as u32).max(1);
                let new_diff = current_diff.saturating_sub(decrease_amount).max(MIN_DIFFICULTY_FLOOR);

                if new_diff != current_diff {
                    MINING_DIFFICULTY.with(|d| d.borrow_mut().set(new_diff).expect("Failed to update difficulty via heartbeat"));

                    let updated = CURRENT_BLOCK.with(|b| {
                        let mut block_cell = b.borrow_mut();
                        if let Some(mut current) = block_cell.get().clone() {
                            current.difficulty = new_diff;
                            current.target = BlockTemplate::calculate_target(new_diff);
                            block_cell.set(Some(current)).expect("Failed to update block template via heartbeat");
                            ic_cdk::println!("Heartbeat triggered: Difficulty reduced from {} to {}", current_diff, new_diff);
                            true
                        } else {
                             ic_cdk::println!("Heartbeat triggered reduction, but no current block template found unexpectedly.");
                             false
                        }
                    });
                    return updated;
                }
            } else {
                 ic_cdk::println!("Heartbeat check: Difficulty already at minimum ({}), no reduction.", MIN_DIFFICULTY_FLOOR);
            }
        }
    } else {
        HEARTBEAT_COUNTER.with(|c| *c.borrow_mut() = 0);
    }
    false
}

// --- Upgrade and Initialization ---

/// Initializes stable memory structures required by the mining module.
/// Also handles restoring default parameters if they seem reset after an upgrade.
pub fn initialize_memory() {
    MEMORY_MANAGER.with(|m| {
        let manager = m.borrow_mut();
        // Check IDs used in thread_local!: 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 24
        let memory_ids = [6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 24]; // Removed 15
        for id in memory_ids {
            manager.get(MemoryId::new(id));
        }
         ic_cdk::println!("Mining memory IDs initialized/retrieved.");
    });

    let difficulty = MINING_DIFFICULTY.with(|d| *d.borrow().get());
    let block_time_target = BLOCK_TIME_TARGET.with(|t| *t.borrow().get());
    let halving_interval = HALVING_INTERVAL.with(|h| *h.borrow().get());
    let block_reward = BLOCK_REWARD.with(|r| *r.borrow().get());

    let mut reinitialized = false;
    let default_difficulty = 10;
    let default_block_time = 60;
    let default_halving = 210_000;
    let default_reward = 50 * 100_000_000;

    let final_difficulty = if difficulty == 0 { reinitialized = true; default_difficulty } else { difficulty };
    let final_block_time = if block_time_target == 0 { reinitialized = true; default_block_time } else { block_time_target };
    let final_halving = if halving_interval == 0 { reinitialized = true; default_halving } else { halving_interval };
    let final_reward = if block_reward == 0 { reinitialized = true; default_reward } else { block_reward };

    if reinitialized {
        ic_cdk::println!("WARN: Critical mining parameters were zero after upgrade. Restoring defaults.");
        MINING_DIFFICULTY.with(|d| d.borrow_mut().set(final_difficulty).expect("Restore failed"));
        BLOCK_TIME_TARGET.with(|t| t.borrow_mut().set(final_block_time).expect("Restore failed"));
        HALVING_INTERVAL.with(|h| h.borrow_mut().set(final_halving).expect("Restore failed"));
        BLOCK_REWARD.with(|r| r.borrow_mut().set(final_reward).expect("Restore failed"));
    }

    let current_block_exists = CURRENT_BLOCK.with(|b| b.borrow().get().is_some());
    let genesis_generated = GENESIS_BLOCK_GENERATED.with(|g| *g.borrow().get());
    let ledger_deployed = crate::LEDGER_ID_CELL.with(|id| id.borrow().get().is_some());

    ic_cdk::println!(
        "Post-upgrade mining state: Ledger={}, Genesis={}, BlockTemplate={}, Difficulty={}, TargetTime={}",
        ledger_deployed, genesis_generated, current_block_exists, final_difficulty, final_block_time
    );

    if ledger_deployed && genesis_generated && !current_block_exists {
        ic_cdk::println!("Post-upgrade: No current block template found. Running heartbeat check...");
        if update_block_template_difficulty() {
             ic_cdk::println!("Post-upgrade: Block template difficulty updated via heartbeat logic.");
        } else {
             ic_cdk::println!("Post-upgrade: Heartbeat check did not result in difficulty update. Next solution submission required.");
        }
    } else if current_block_exists {
        CURRENT_BLOCK.with(|b| {
            let mut block_cell = b.borrow_mut();
            if let Some(mut current) = block_cell.get().clone() {
                if current.difficulty != final_difficulty {
                     ic_cdk::println!("Post-upgrade: Updating existing block template difficulty from {} to {}.", current.difficulty, final_difficulty);
                     current.difficulty = final_difficulty;
                     current.target = BlockTemplate::calculate_target(final_difficulty);
                     block_cell.set(Some(current)).expect("Failed to update block template post-upgrade");
                }
            }
        });
    }
}


// --- Genesis Block Creation ---

fn check_genesis_not_generated() -> Result<(), String> {
    if GENESIS_BLOCK_GENERATED.with(|g| *g.borrow().get()) {
        return Err("Genesis block already generated (flag is set).".to_string());
    }
    if CURRENT_BLOCK.with(|b| b.borrow().get().is_some()) {
        return Err("Genesis block seems generated (block template exists).".to_string());
    }
    let height = BLOCK_HEIGHT.with(|h| *h.borrow().get());
    if height > 0 {
        return Err(format!("Genesis block seems generated (height is {}).", height));
    }
    Ok(())
}

#[ic_cdk::update]
pub async fn create_genesis_block() -> Result<BlockTemplate, String> {
    let caller = ic_cdk::caller();
    if !ic_cdk::api::is_controller(&caller) {
        return Err("Only the controller can create the genesis block.".to_string());
    }
    if !crate::LEDGER_ID_CELL.with(|id| id.borrow().get().is_some()) {
        return Err("Cannot create genesis block: Ledger ID not set.".to_string());
    }
    check_genesis_not_generated()?;

    ic_cdk::println!("Controller {} initiating genesis block creation...", caller);
    match generate_new_block().await {
        Ok(block_template) => {
            if block_template.height != 1 {
                 return Err(format!(
                    "Genesis block generation returned unexpected height: {}. Expected 1.",
                    block_template.height
                ));
            }
            GENESIS_BLOCK_GENERATED.with(|g| {
                g.borrow_mut().set(true).expect("Failed to set genesis block generated flag");
            });
            ic_cdk::println!("Genesis block (Height: 1) successfully generated by {}.", caller);
            Ok(block_template)
        }
        Err(e) => {
            ic_cdk::println!("Failed to generate genesis block: {}", e);
            Err(e)
        }
    }
}


// --- Controller Parameter Restoration ---

#[ic_cdk::update]
pub fn restore_mining_params(
    block_reward: u64,
    mining_difficulty: u32,
    block_time_target: u64,
    halving_interval: u64,
) -> Result<(), String> {
    let caller = ic_cdk::caller();
    if !ic_cdk::api::is_controller(&caller) {
        return Err("Only the controller can restore mining parameters".to_string());
    }

    if block_time_target == 0 { return Err("Block time target cannot be zero.".to_string()); }
    if mining_difficulty == 0 { return Err("Mining difficulty cannot be zero.".to_string()); }

    MINING_DIFFICULTY.with(|d| d.borrow_mut().set(mining_difficulty).expect("Restore failed"));
    BLOCK_TIME_TARGET.with(|t| t.borrow_mut().set(block_time_target).expect("Restore failed"));
    HALVING_INTERVAL.with(|h| h.borrow_mut().set(halving_interval).expect("Restore failed"));
    BLOCK_REWARD.with(|r| r.borrow_mut().set(block_reward).expect("Restore failed"));

    ic_cdk::println!(
        "Controller {} manually restored mining params: Reward={}, Diff={}, TargetTime={}, Halving={}",
        caller, block_reward, mining_difficulty, block_time_target, halving_interval
    );

    CURRENT_BLOCK.with(|b| {
        let mut block_cell = b.borrow_mut();
        if let Some(mut current) = block_cell.get().clone() {
            ic_cdk::println!("Updating current block template with restored difficulty...");
            current.difficulty = mining_difficulty;
            current.target = BlockTemplate::calculate_target(mining_difficulty);
            block_cell.set(Some(current)).expect("Failed to update block template after restore");
        }
    });

    Ok(())
}