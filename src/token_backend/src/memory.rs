use std::cell::RefCell;
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl, StableBTreeMap, StableCell
};

use crate::types::{StorablePrincipal, TokenInfo, MinerInfo, DelegationData};
use crate::block_templates::BlockTemplate;
use crate::mining::{StorableHash, StorableTimestamps, StorableSolutions, BloomFilter};

// Define Memory type alias
pub type Memory = VirtualMemory<DefaultMemoryImpl>;

// --- Memory IDs ---
const TOKEN_INFO_ID: MemoryId = MemoryId::new(0);
const CREATOR_ID: MemoryId = MemoryId::new(1);
const LEDGER_ID_ID: MemoryId = MemoryId::new(2);
const CIRCULATING_SUPPLY_ID: MemoryId = MemoryId::new(3);
const MINERS_MAP_ID: MemoryId = MemoryId::new(4);
const CURRENT_BLOCK_ID: MemoryId = MemoryId::new(5);
const LAST_BLOCK_HASH_ID: MemoryId = MemoryId::new(6);
const BLOCK_HEIGHT_ID: MemoryId = MemoryId::new(7);
const MINING_DIFFICULTY_ID: MemoryId = MemoryId::new(8);
const BLOCK_REWARD_ID: MemoryId = MemoryId::new(9);
const BLOCK_TIME_TARGET_ID: MemoryId = MemoryId::new(10);
const BLOCK_TIMESTAMPS_ID: MemoryId = MemoryId::new(11);
const PROCESSED_SOLUTIONS_ID: MemoryId = MemoryId::new(12);
const SOLUTION_BLOOM_FILTER_ID: MemoryId = MemoryId::new(13);
const HALVING_INTERVAL_ID: MemoryId = MemoryId::new(14);
const DELEGATIONS_ID: MemoryId = MemoryId::new(15);
const FAILED_ATTEMPTS_ID: MemoryId = MemoryId::new(16);
const GENESIS_BLOCK_GENERATED_ID: MemoryId = MemoryId::new(17);

// --- Memory Manager ---
thread_local! {
    // The memory manager is responsible for allocating virtual memory slices to stable structures.
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
        MemoryManager::init(DefaultMemoryImpl::default())
    );
}

// --- Stable Structures Definitions ---
// Note: We are defining the *types* here, but the actual instances will be within thread_locals
// for controlled access.

// Placeholder struct to hold all stable memory structures
// We will initialize these within a thread_local below.
struct StableMemory {
    token_info: StableCell<Option<TokenInfo>, Memory>,
    creator: StableCell<Option<StorablePrincipal>, Memory>,
    ledger_id: StableCell<Option<StorablePrincipal>, Memory>,
    circulating_supply: StableCell<u64, Memory>,
    miners_map: StableBTreeMap<StorablePrincipal, MinerInfo, Memory>,
    current_block: StableCell<Option<BlockTemplate>, Memory>,
    last_block_hash: StableCell<StorableHash, Memory>,
    block_height: StableCell<u64, Memory>,
    mining_difficulty: StableCell<u32, Memory>,
    block_reward: StableCell<u64, Memory>,
    block_time_target: StableCell<u64, Memory>,
    block_timestamps: StableCell<StorableTimestamps, Memory>,
    processed_solutions: StableCell<StorableSolutions, Memory>,
    solution_bloom_filter: StableCell<BloomFilter, Memory>,
    halving_interval: StableCell<u64, Memory>,
    genesis_block_generated: StableCell<bool, Memory>,
    delegations: StableBTreeMap<StorablePrincipal, DelegationData, Memory>,
    failed_attempts: StableBTreeMap<StorablePrincipal, (u32, u64), Memory>,
}

thread_local! {
    // This thread_local holds the initialized stable structures.
    static STABLE_MEMORY: RefCell<StableMemory> = RefCell::new(
        MEMORY_MANAGER.with(|mm| {
            let memory_manager = mm.borrow();
            StableMemory {
                token_info: StableCell::init(memory_manager.get(TOKEN_INFO_ID), None)
                    .expect("Failed to init TOKEN_INFO stable cell"),
                creator: StableCell::init(memory_manager.get(CREATOR_ID), None)
                    .expect("Failed to init CREATOR stable cell"),
                ledger_id: StableCell::init(memory_manager.get(LEDGER_ID_ID), None)
                    .expect("Failed to init LEDGER_ID stable cell"),
                circulating_supply: StableCell::init(memory_manager.get(CIRCULATING_SUPPLY_ID), 0)
                    .expect("Failed to init CIRCULATING_SUPPLY stable cell"),
                miners_map: StableBTreeMap::init(memory_manager.get(MINERS_MAP_ID)),
                current_block: StableCell::init(memory_manager.get(CURRENT_BLOCK_ID), None)
                    .expect("Failed to init CURRENT_BLOCK stable cell"),
                last_block_hash: StableCell::init(memory_manager.get(LAST_BLOCK_HASH_ID), StorableHash([0; 32]))
                    .expect("Failed to init LAST_BLOCK_HASH stable cell"),
                block_height: StableCell::init(memory_manager.get(BLOCK_HEIGHT_ID), 0)
                    .expect("Failed to init BLOCK_HEIGHT stable cell"),
                mining_difficulty: StableCell::init(memory_manager.get(MINING_DIFFICULTY_ID), 0) // Initial value set later
                    .expect("Failed to init MINING_DIFFICULTY stable cell"),
                block_reward: StableCell::init(memory_manager.get(BLOCK_REWARD_ID), 0) // Initial value set later
                    .expect("Failed to init BLOCK_REWARD stable cell"),
                block_time_target: StableCell::init(memory_manager.get(BLOCK_TIME_TARGET_ID), 0) // Initial value set later
                    .expect("Failed to init BLOCK_TIME_TARGET stable cell"),
                block_timestamps: StableCell::init(memory_manager.get(BLOCK_TIMESTAMPS_ID), StorableTimestamps(Vec::new()))
                    .expect("Failed to init BLOCK_TIMESTAMPS stable cell"),
                processed_solutions: StableCell::init(memory_manager.get(PROCESSED_SOLUTIONS_ID), StorableSolutions(Vec::new()))
                    .expect("Failed to init PROCESSED_SOLUTIONS stable cell"),
                solution_bloom_filter: StableCell::init(memory_manager.get(SOLUTION_BLOOM_FILTER_ID), BloomFilter::new())
                    .expect("Failed to init SOLUTION_BLOOM_FILTER stable cell"),
                halving_interval: StableCell::init(memory_manager.get(HALVING_INTERVAL_ID), 0) // Initial value set later
                    .expect("Failed to init HALVING_INTERVAL stable cell"),
                genesis_block_generated: StableCell::init(memory_manager.get(GENESIS_BLOCK_GENERATED_ID), false)
                    .expect("Failed to init GENESIS_BLOCK_GENERATED stable cell"),
                delegations: StableBTreeMap::init(memory_manager.get(DELEGATIONS_ID)),
                failed_attempts: StableBTreeMap::init(memory_manager.get(FAILED_ATTEMPTS_ID)),
            }
        })
    );
}

// --- Accessor Functions --- Access with closures `with_...` and `with_..._mut`

// Token Info
pub fn with_token_info<F, R>(f: F) -> R
    where F: FnOnce(&Option<TokenInfo>) -> R
{
    STABLE_MEMORY.with(|s| f(s.borrow().token_info.get()))
}
pub fn with_token_info_mut<F, R>(f: F) -> R
    where F: FnOnce(&mut StableCell<Option<TokenInfo>, Memory>) -> R
{
    STABLE_MEMORY.with(|s| f(&mut s.borrow_mut().token_info))
}

// Creator
pub fn with_creator<F, R>(f: F) -> R
    where F: FnOnce(&Option<StorablePrincipal>) -> R
{
    STABLE_MEMORY.with(|s| f(s.borrow().creator.get()))
}
pub fn with_creator_mut<F, R>(f: F) -> R
    where F: FnOnce(&mut StableCell<Option<StorablePrincipal>, Memory>) -> R
{
    STABLE_MEMORY.with(|s| f(&mut s.borrow_mut().creator))
}

// Ledger ID
pub fn with_ledger_id<F, R>(f: F) -> R
    where F: FnOnce(&Option<StorablePrincipal>) -> R
{
    STABLE_MEMORY.with(|s| f(s.borrow().ledger_id.get()))
}
pub fn with_ledger_id_mut<F, R>(f: F) -> R
    where F: FnOnce(&mut StableCell<Option<StorablePrincipal>, Memory>) -> R
{
    STABLE_MEMORY.with(|s| f(&mut s.borrow_mut().ledger_id))
}

// Circulating Supply
pub fn with_circulating_supply<F, R>(f: F) -> R
    where F: FnOnce(&u64) -> R
{
    STABLE_MEMORY.with(|s| f(s.borrow().circulating_supply.get()))
}
pub fn with_circulating_supply_mut<F, R>(f: F) -> R
    where F: FnOnce(&mut StableCell<u64, Memory>) -> R
{
    STABLE_MEMORY.with(|s| f(&mut s.borrow_mut().circulating_supply))
}

// Miners Map
pub fn with_miners_map<F, R>(f: F) -> R
    where F: FnOnce(&StableBTreeMap<StorablePrincipal, MinerInfo, Memory>) -> R
{
    STABLE_MEMORY.with(|s| f(&s.borrow().miners_map))
}
pub fn with_miners_map_mut<F, R>(f: F) -> R
    where F: FnOnce(&mut StableBTreeMap<StorablePrincipal, MinerInfo, Memory>) -> R
{
    STABLE_MEMORY.with(|s| f(&mut s.borrow_mut().miners_map))
}

// Current Block
pub fn with_current_block<F, R>(f: F) -> R
    where F: FnOnce(&Option<BlockTemplate>) -> R
{
    STABLE_MEMORY.with(|s| f(s.borrow().current_block.get()))
}
pub fn with_current_block_mut<F, R>(f: F) -> R
    where F: FnOnce(&mut StableCell<Option<BlockTemplate>, Memory>) -> R
{
    STABLE_MEMORY.with(|s| f(&mut s.borrow_mut().current_block))
}

// Last Block Hash
pub fn with_last_block_hash<F, R>(f: F) -> R
    where F: FnOnce(&StorableHash) -> R
{
    STABLE_MEMORY.with(|s| f(s.borrow().last_block_hash.get()))
}
pub fn with_last_block_hash_mut<F, R>(f: F) -> R
    where F: FnOnce(&mut StableCell<StorableHash, Memory>) -> R
{
    STABLE_MEMORY.with(|s| f(&mut s.borrow_mut().last_block_hash))
}

// Block Height
pub fn with_block_height<F, R>(f: F) -> R
    where F: FnOnce(&u64) -> R
{
    STABLE_MEMORY.with(|s| f(s.borrow().block_height.get()))
}
pub fn with_block_height_mut<F, R>(f: F) -> R
    where F: FnOnce(&mut StableCell<u64, Memory>) -> R
{
    STABLE_MEMORY.with(|s| f(&mut s.borrow_mut().block_height))
}

// Mining Difficulty
pub fn with_mining_difficulty<F, R>(f: F) -> R
    where F: FnOnce(&u32) -> R
{
    STABLE_MEMORY.with(|s| f(s.borrow().mining_difficulty.get()))
}
pub fn with_mining_difficulty_mut<F, R>(f: F) -> R
    where F: FnOnce(&mut StableCell<u32, Memory>) -> R
{
    STABLE_MEMORY.with(|s| f(&mut s.borrow_mut().mining_difficulty))
}

// Block Reward
pub fn with_block_reward<F, R>(f: F) -> R
    where F: FnOnce(&u64) -> R
{
    STABLE_MEMORY.with(|s| f(s.borrow().block_reward.get()))
}
pub fn with_block_reward_mut<F, R>(f: F) -> R
    where F: FnOnce(&mut StableCell<u64, Memory>) -> R
{
    STABLE_MEMORY.with(|s| f(&mut s.borrow_mut().block_reward))
}

// Block Time Target
pub fn with_block_time_target<F, R>(f: F) -> R
    where F: FnOnce(&u64) -> R
{
    STABLE_MEMORY.with(|s| f(s.borrow().block_time_target.get()))
}
pub fn with_block_time_target_mut<F, R>(f: F) -> R
    where F: FnOnce(&mut StableCell<u64, Memory>) -> R
{
    STABLE_MEMORY.with(|s| f(&mut s.borrow_mut().block_time_target))
}

// Block Timestamps
pub fn with_block_timestamps<F, R>(f: F) -> R
    where F: FnOnce(&StorableTimestamps) -> R
{
    STABLE_MEMORY.with(|s| f(s.borrow().block_timestamps.get()))
}
pub fn with_block_timestamps_mut<F, R>(f: F) -> R
    where F: FnOnce(&mut StableCell<StorableTimestamps, Memory>) -> R
{
    STABLE_MEMORY.with(|s| f(&mut s.borrow_mut().block_timestamps))
}

// Processed Solutions
pub fn with_processed_solutions<F, R>(f: F) -> R
    where F: FnOnce(&StorableSolutions) -> R
{
    STABLE_MEMORY.with(|s| f(s.borrow().processed_solutions.get()))
}
pub fn with_processed_solutions_mut<F, R>(f: F) -> R
    where F: FnOnce(&mut StableCell<StorableSolutions, Memory>) -> R
{
    STABLE_MEMORY.with(|s| f(&mut s.borrow_mut().processed_solutions))
}

// Solution Bloom Filter
pub fn with_solution_bloom_filter<F, R>(f: F) -> R
    where F: FnOnce(&BloomFilter) -> R
{
    STABLE_MEMORY.with(|s| f(s.borrow().solution_bloom_filter.get()))
}
pub fn with_solution_bloom_filter_mut<F, R>(f: F) -> R
    where F: FnOnce(&mut StableCell<BloomFilter, Memory>) -> R
{
    STABLE_MEMORY.with(|s| f(&mut s.borrow_mut().solution_bloom_filter))
}

// Halving Interval
pub fn with_halving_interval<F, R>(f: F) -> R
    where F: FnOnce(&u64) -> R
{
    STABLE_MEMORY.with(|s| f(s.borrow().halving_interval.get()))
}
pub fn with_halving_interval_mut<F, R>(f: F) -> R
    where F: FnOnce(&mut StableCell<u64, Memory>) -> R
{
    STABLE_MEMORY.with(|s| f(&mut s.borrow_mut().halving_interval))
}

// Genesis Block Generated
pub fn with_genesis_block_generated<F, R>(f: F) -> R
    where F: FnOnce(&bool) -> R
{
    STABLE_MEMORY.with(|s| f(s.borrow().genesis_block_generated.get()))
}
pub fn with_genesis_block_generated_mut<F, R>(f: F) -> R
    where F: FnOnce(&mut StableCell<bool, Memory>) -> R
{
    STABLE_MEMORY.with(|s| f(&mut s.borrow_mut().genesis_block_generated))
}

// Delegations Map
pub fn with_delegations_map<F, R>(f: F) -> R
    where F: FnOnce(&StableBTreeMap<StorablePrincipal, DelegationData, Memory>) -> R
{
    STABLE_MEMORY.with(|s| f(&s.borrow().delegations))
}
pub fn with_delegations_map_mut<F, R>(f: F) -> R
    where F: FnOnce(&mut StableBTreeMap<StorablePrincipal, DelegationData, Memory>) -> R
{
    STABLE_MEMORY.with(|s| f(&mut s.borrow_mut().delegations))
}

pub fn with_failed_attempts_map_mut<F, R>(f: F) -> R
    where F: FnOnce(&mut StableBTreeMap<StorablePrincipal, (u32, u64), Memory>) -> R
{
    STABLE_MEMORY.with(|s| f(&mut s.borrow_mut().failed_attempts))
}

// --- Initialization ---
// Function to ensure all memory regions are initialized. Called from init/post_upgrade.
pub fn init_memory() {
     MEMORY_MANAGER.with(|m| {
        let _mm = m.borrow_mut();
        _mm.get(TOKEN_INFO_ID);
        _mm.get(CREATOR_ID);
        _mm.get(LEDGER_ID_ID);
        _mm.get(CIRCULATING_SUPPLY_ID);
        _mm.get(MINERS_MAP_ID);
        _mm.get(CURRENT_BLOCK_ID);
        _mm.get(LAST_BLOCK_HASH_ID);
        _mm.get(BLOCK_HEIGHT_ID);
        _mm.get(MINING_DIFFICULTY_ID);
        _mm.get(BLOCK_REWARD_ID);
        _mm.get(BLOCK_TIME_TARGET_ID);
        _mm.get(BLOCK_TIMESTAMPS_ID);
        _mm.get(PROCESSED_SOLUTIONS_ID);
        _mm.get(SOLUTION_BLOOM_FILTER_ID);
        _mm.get(HALVING_INTERVAL_ID);
        _mm.get(DELEGATIONS_ID);
        _mm.get(FAILED_ATTEMPTS_ID);
        _mm.get(GENESIS_BLOCK_GENERATED_ID);
    });
    STABLE_MEMORY.with(|_| {});
     ic_cdk::println!("Memory module initialized and all stable memories allocated.");
}
