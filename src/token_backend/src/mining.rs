// src/token_backend/src/mining.rs

use candid::{CandidType, Deserialize};
use ciborium;
use ic_stable_structures::storable::Bound;
use ic_stable_structures::Storable;
use lru::LruCache;
use serde::Serialize;
use std::borrow::Cow;
use std::cell::RefCell;
use std::num::NonZeroUsize;
use candid::Principal;

use crate::block_templates::{BlockTemplate, Hash};
use crate::memory;
use crate::types::{StorablePrincipal, MinerStatus};

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
    pub(crate) fn new() -> Self {
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
    pub(crate) static HEARTBEAT_COUNTER: RefCell<u32> = RefCell::new(0);
}

/// Initialize mining parameters. Called once during initial canister deployment.
pub fn init_mining_params(initial_block_reward: u64, block_time_target: u64, halving_interval: u64) {
    const INITIAL_DIFFICULTY: u32 = 10; // Set a reasonable starting difficulty

    memory::with_block_reward_mut(|cell| cell.set(initial_block_reward).expect("Failed to set block reward"));
    memory::with_mining_difficulty_mut(|cell| cell.set(INITIAL_DIFFICULTY).expect("Failed to set mining difficulty"));
    memory::with_block_time_target_mut(|cell| cell.set(block_time_target).expect("Failed to set block time target"));
    memory::with_halving_interval_mut(|cell| cell.set(halving_interval).expect("Failed to set halving interval"));
    memory::with_block_timestamps_mut(|cell| cell.set(StorableTimestamps(Vec::new())).expect("Failed to init timestamps"));
    memory::with_block_height_mut(|cell| cell.set(0).expect("Failed to init block height"));
    memory::with_last_block_hash_mut(|cell| cell.set(StorableHash([0; 32])).expect("Failed to init last block hash"));
    memory::with_genesis_block_generated_mut(|cell| cell.set(false).expect("Failed to init genesis flag"));

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

    let target_time_sec = memory::with_block_time_target(|t| *t);
    let current_diff = memory::with_mining_difficulty(|d| *d);

    // Get timestamp of the last block (in seconds)
    let last_timestamp_sec = memory::with_block_timestamps(|timestamps|
        timestamps.0.last().map(|ns| ns / 1_000_000_000)
    );

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
    let ledger_deployed = memory::with_ledger_id(|id_opt| id_opt.is_some());
    let genesis_generated = memory::with_genesis_block_generated(|g| *g);
    let current_block = memory::with_current_block(|b_opt| b_opt.clone());

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
/// Uses memory module accessors.
pub fn calculate_block_reward(block_height: u64) -> u64 {
    let initial_reward = memory::with_block_reward(|r| *r);
    let halving_interval = memory::with_halving_interval(|h| *h);

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
    let height = memory::with_block_height(|h| *h);
    let next_height = height + 1;

    // Miner check: Only registered active miners can *trigger* new block generation *after* genesis
    // The genesis block creation is triggered by the controller via `create_genesis_block`.
    if height > 0 {
        let caller = ic_cdk::caller();
        let is_active_miner = memory::with_miners_map(|miners_map| {
            miners_map.get(&StorablePrincipal(caller))
                .map(|info| matches!(info.status, MinerStatus::Active))
                .unwrap_or(false)
        });

        // Also allow the canister itself (for heartbeat/post-upgrade checks if implemented)
        if !is_active_miner && caller != ic_cdk::api::id() {
            return Err("Only registered active miners can trigger new block generation after genesis.".to_string());
        }
    }

    // Get previous block hash (will be zeros for genesis)
    let prev_hash = memory::with_last_block_hash(|h| h.0); // Get inner Hash

    // Adjust difficulty based on previous block time
    let new_difficulty = adjust_difficulty();

    // Update stable memory with the calculated difficulty *before* creating the block
    memory::with_mining_difficulty_mut(|cell| {
        cell.set(new_difficulty).expect("Failed to update difficulty")
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

        memory::with_current_block_mut(|cell| {
            cell.set(Some(fixed_block.clone())).expect("Failed to set fixed current block")
        });
        memory::with_block_height_mut(|cell| {
            cell.set(next_height).expect("Failed to update block height for fixed block")
        });
        Ok(fixed_block)
    } else {
        memory::with_current_block_mut(|cell| {
            cell.set(Some(block.clone())).expect("Failed to set current block")
        });
        memory::with_block_height_mut(|cell| {
            cell.set(next_height).expect("Failed to update block height")
        });
        Ok(block)
    }
}

/// Calculates the expected heartbeat interval based on block time target.
fn calculate_heartbeat_interval() -> u64 {
    let target_time = memory::with_block_time_target(|t| *t);
    if target_time == 0 { return 6; }
    (target_time / 10).clamp(1, 60)
}

/// Called periodically (e.g., by canister_heartbeat) to potentially lower difficulty
/// if no blocks have been mined for a while.
pub fn update_block_template_difficulty() -> bool {
     if !memory::with_genesis_block_generated(|g| *g) || memory::with_current_block(|b| b.is_none()) {
         return false;
     }

    let now_sec = ic_cdk::api::time() / 1_000_000_000;
    let last_timestamp_sec = match memory::with_block_timestamps(|ts| ts.0.last().copied()) {
        Some(ns) => ns / 1_000_000_000,
        None => return false,
    };

    let target_time_sec = memory::with_block_time_target(|t| *t);
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
            let current_diff = memory::with_mining_difficulty(|d| *d);
            const MIN_DIFFICULTY_FLOOR: u32 = 5;

            if current_diff > MIN_DIFFICULTY_FLOOR {
                let reduction_percentage = 15;
                let decrease_amount = ((current_diff as u64 * reduction_percentage / 100) as u32).max(1);
                let new_diff = current_diff.saturating_sub(decrease_amount).max(MIN_DIFFICULTY_FLOOR);

                if new_diff != current_diff {
                    memory::with_mining_difficulty_mut(|cell| cell.set(new_diff).expect("Failed to update difficulty via heartbeat"));

                    let update_succeeded = memory::with_current_block_mut(|current_block_cell| {
                        if let Some(mut current) = current_block_cell.get().clone() {
                            current.difficulty = new_diff;
                            current.target = BlockTemplate::calculate_target(new_diff);
                            current_block_cell.set(Some(current)).expect("Failed to update block template via heartbeat");
                            ic_cdk::println!("Heartbeat triggered: Difficulty reduced from {} to {}", current_diff, new_diff);
                            true // Indicate success
                        } else {
                            ic_cdk::println!("Heartbeat triggered reduction, but no current block template found unexpectedly.");
                            false // Indicate failure
                        }
                    });
                    return update_succeeded; // Return the captured result
                } else {
                    // Difficulty didn't change, return false
                    return false;
                }
            } else {
                 ic_cdk::println!("Heartbeat check: Difficulty already at minimum ({}), no reduction.", MIN_DIFFICULTY_FLOOR);
                 return false;
            }
        }
    } else {
        HEARTBEAT_COUNTER.with(|c| *c.borrow_mut() = 0);
    }
    false // Default return if no decrease happened
}


// --- Upgrade and Initialization ---

/// Initializes mining-specific logic after upgrade. Uses memory module accessors.
/// Assumes `memory::init_memory()` has already been called in `post_upgrade`.
pub fn initialize_memory() {
    let difficulty = memory::with_mining_difficulty(|d| *d);
    let block_time_target = memory::with_block_time_target(|t| *t);
    let halving_interval = memory::with_halving_interval(|h| *h);
    let block_reward = memory::with_block_reward(|r| *r);

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
        memory::with_mining_difficulty_mut(|cell| cell.set(final_difficulty).expect("Restore failed"));
        memory::with_block_time_target_mut(|cell| cell.set(final_block_time).expect("Restore failed"));
        memory::with_halving_interval_mut(|cell| cell.set(final_halving).expect("Restore failed"));
        memory::with_block_reward_mut(|cell| cell.set(final_reward).expect("Restore failed"));
    }

    let current_block_exists = memory::with_current_block(|b| b.is_some());
    let genesis_generated = memory::with_genesis_block_generated(|g| *g);
    let ledger_deployed = memory::with_ledger_id(|id| id.is_some());

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
        memory::with_current_block_mut(|block_cell| {
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
     ic_cdk::println!("Mining module specific post-upgrade checks completed.");
}


// --- Genesis Block Creation ---

fn check_genesis_not_generated() -> Result<(), String> {
    if memory::with_genesis_block_generated(|g| *g) {
        return Err("Genesis block already generated (flag is set).".to_string());
    }
    if memory::with_current_block(|b| b.is_some()) {
        return Err("Genesis block seems generated (block template exists).".to_string());
    }
    let height = memory::with_block_height(|h| *h);
    if height > 0 {
        return Err(format!("Genesis block seems generated (height is {}).", height));
    }
    Ok(())
}

#[ic_cdk::update]
pub async fn create_genesis_block() -> Result<BlockTemplate, String> {
    let caller = ic_cdk::caller();
    let creator_principal: Option<Principal> = memory::with_creator(|creator_opt| {
        creator_opt.as_ref().map(|storable_p| storable_p.0) // Get Principal
    });

    // Allow controller OR the original creator principal stored in memory
    if !ic_cdk::api::is_controller(&caller) && creator_principal != Some(caller) {
        return Err("Only the controller or original creator can create the genesis block.".to_string());
    }
    if memory::with_ledger_id(|id| id.is_none()) {
        return Err("Cannot create genesis block: Ledger ID not set.".to_string());
    }
    check_genesis_not_generated()?;

    match generate_new_block().await {
        Ok(block_template) => {
            if block_template.height != 1 {
                 return Err(format!(
                    "Genesis block generation returned unexpected height: {}. Expected 1.",
                    block_template.height
                ));
            }
            memory::with_genesis_block_generated_mut(|cell| {
                cell.set(true).expect("Failed to set genesis block generated flag")
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

