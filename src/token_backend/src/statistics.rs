use crate::types::MiningInfo;
use crate::mining::{BLOCK_HEIGHT, MINING_DIFFICULTY, BLOCK_REWARD, HALVING_INTERVAL, BLOCK_TIME_TARGET, BLOCK_TIMESTAMPS, GENESIS_BLOCK_GENERATED, calculate_block_reward};
use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Clone, Debug)] // Add necessary derive macros
pub enum BlockTimeResult {
    Ok(f64), // Average block time in seconds
    Err(String),
}

#[ic_cdk::query]
pub fn get_block_height() -> u64 {
    BLOCK_HEIGHT.with(|h| *h.borrow().get())
}

#[ic_cdk::query]
pub fn get_mining_difficulty() -> u32 {
    MINING_DIFFICULTY.with(|d| *d.borrow().get())
}

#[ic_cdk::query]
pub fn get_mining_info() -> MiningInfo {
    let _initial_block_reward = BLOCK_REWARD.with(|r| *r.borrow().get()); // Keep name distinct if not used
    let halving_interval = HALVING_INTERVAL.with(|h| *h.borrow().get());
    let difficulty = get_mining_difficulty(); // Call local function
    let block_height = get_block_height(); // Call local function
    let block_time_target_sec = get_block_time_target(); // Call local function

    // Calculate the current reward based on block height and halving
    let actual_current_reward = calculate_block_reward(block_height);

    // Calculate next halving
    let next_halving_in = if halving_interval == 0 || block_height == 0 {
        0 // Halving disabled or before first block
    } else {
        let blocks_since_last_halving = (block_height - 1) % halving_interval;
        halving_interval - blocks_since_last_halving
    };

    MiningInfo {
        current_difficulty: difficulty,
        block_time_target: block_time_target_sec,
        next_halving_interval: next_halving_in,
        current_block_reward: actual_current_reward, // Add this field based on types.rs
    }
}

#[ic_cdk::query]
pub fn get_block_time_target() -> u64 {
    BLOCK_TIME_TARGET.with(|t| *t.borrow().get())
}


#[ic_cdk::query]
pub fn get_average_block_time(window_size: Option<u32>) -> BlockTimeResult {
    const DEFAULT_WINDOW_SIZE: usize = 100; // Calculate avg over last 100 blocks
    const MIN_WINDOW_SIZE: usize = 2; // Need at least 2 timestamps for an interval

    let window = window_size.map(|s| s as usize).unwrap_or(DEFAULT_WINDOW_SIZE).max(MIN_WINDOW_SIZE);

    let timestamps_ns = BLOCK_TIMESTAMPS.with(|ts| ts.borrow().get().0.clone());

    if timestamps_ns.len() < MIN_WINDOW_SIZE {
        return BlockTimeResult::Err(format!(
            "Not enough blocks mined yet ({} < {}) to calculate average time.",
            timestamps_ns.len(),
            MIN_WINDOW_SIZE
        ));
    }

    // Take the most recent `window + 1` timestamps to calculate `window` intervals
    let relevant_timestamps: Vec<u64> = timestamps_ns
        .iter()
        .rev()
        .take(window + 1)
        .cloned()
        .collect();

    // Need at least 2 timestamps in the relevant window
    if relevant_timestamps.len() < MIN_WINDOW_SIZE {
         return BlockTimeResult::Err(format!(
            "Not enough blocks in the requested window ({} requested, {} available < {}) to calculate average time.",
            window,
            relevant_timestamps.len(),
            MIN_WINDOW_SIZE
        ));
    }

    // Calculate time differences between consecutive blocks (in nanoseconds)
    // Note: We iterate over the reversed (newest first) timestamps, so diffs are positive
    let diffs_ns: Vec<u64> = relevant_timestamps
        .windows(2)
        .map(|pair| pair[0].saturating_sub(pair[1])) // newest - older
        .collect();

    if diffs_ns.is_empty() {
        // Should not happen if relevant_timestamps.len() >= 2, but handle defensively
        return BlockTimeResult::Err("Could not calculate any time differences.".to_string());
    }

    // Calculate average difference in nanoseconds
    let total_diff_ns: u64 = diffs_ns.iter().sum();
    let avg_diff_ns = total_diff_ns as f64 / diffs_ns.len() as f64;

    // Convert average difference to seconds
    let avg_time_sec = avg_diff_ns / 1_000_000_000.0;

    if avg_time_sec.is_finite() && avg_time_sec > 0.0 {
        BlockTimeResult::Ok(avg_time_sec)
    } else {
        // Handle potential division by zero or non-finite results
        BlockTimeResult::Err(format!("Calculation resulted in invalid average time: {:.2}", avg_time_sec))
    }
}

#[ic_cdk::query]
pub fn is_genesis_block_generated() -> bool {
    GENESIS_BLOCK_GENERATED.with(|g| *g.borrow().get())
}
