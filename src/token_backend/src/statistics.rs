use candid::{CandidType, Deserialize};
use crate::memory;
use crate::types::MiningInfo;

#[derive(CandidType, Deserialize, Debug)]
pub enum BlockTimeResult {
    Ok(f64),
    Err(String),
}

#[ic_cdk::query]
pub fn get_block_height() -> u64 {
    memory::with_block_height(|h| *h)
}

#[ic_cdk::query]
pub fn get_mining_difficulty() -> u32 {
    memory::with_mining_difficulty(|d| *d)
}

#[ic_cdk::query]
pub fn get_mining_info() -> MiningInfo {
    let current_difficulty = memory::with_mining_difficulty(|d| *d);
    let block_time_target = memory::with_block_time_target(|t| *t);
    let next_halving_interval = memory::with_halving_interval(|h| *h);
    let block_height = memory::with_block_height(|h| *h);

    let current_block_reward = crate::mining::calculate_block_reward(block_height);

    MiningInfo {
        current_difficulty,
        current_block_reward,
        block_time_target,
        next_halving_interval,
    }
}

#[ic_cdk::query]
pub fn get_block_time_target() -> u64 {
    memory::with_block_time_target(|t| *t)
}

#[ic_cdk::query]
pub fn get_average_block_time(lookback: Option<usize>) -> BlockTimeResult {
    const DEFAULT_LOOKBACK: usize = 100;
    let lookback = lookback.unwrap_or(DEFAULT_LOOKBACK).max(2);

    memory::with_block_timestamps(|timestamps| {
        let ts_vec = &timestamps.0;

        if ts_vec.len() < 2 {
            return BlockTimeResult::Err("Not enough blocks mined yet".to_string());
        }

        let relevant_timestamps: Vec<_> = ts_vec.iter().rev().take(lookback + 1).rev().cloned().collect();

        if relevant_timestamps.len() < 2 {
            return BlockTimeResult::Err(format!(
                "Not enough blocks in the specified lookback period ({} requested, {} available)",
                lookback, ts_vec.len()
            ));
        }

        let intervals: Vec<f64> = relevant_timestamps
            .windows(2)
            .map(|w| (w[1].saturating_sub(w[0])) as f64 / 1_000_000_000.0)
            .collect();

        if intervals.is_empty() {
            return BlockTimeResult::Err("No block intervals found".to_string());
        }

        let avg_time: f64 = intervals.iter().sum::<f64>() / intervals.len() as f64;

        BlockTimeResult::Ok(avg_time)
    })
}
