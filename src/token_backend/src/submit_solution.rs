use candid::Principal;
use ic_cdk::api::time;
use crate::block_templates::{BlockTemplate, Hash};
use crate::mining::{StorableHash, StorableTimestamps, StorableSolution, StorableSolutions, calculate_block_reward, generate_new_block};
use crate::memory;
use crate::types::{StorablePrincipal, MinerStatus};
use crate::{update_circulating_supply, update_miner_stats};

const MAX_PROCESSED_SOLUTIONS: usize = 100;
const MAX_TIMESTAMPS: usize = 1024;

#[derive(candid::CandidType, serde::Deserialize, Debug, Clone, PartialEq, Eq)]
pub enum SolutionError {
    NoBlockToMine,
    VerificationFailed,
    DuplicateSolution,
    StaleBlock,
    InternalError(String),
    UnauthorizedMiner,
}

#[ic_cdk::update]
pub async fn submit_solution(
    nonce: u64,
    solution_hash: Hash,
    miner_principal: Principal,
) -> Result<BlockTemplate, SolutionError> {
    let current_time_ns = time();

    let is_active_miner = memory::with_miners_map(|miners_map| {
        miners_map.get(&StorablePrincipal(miner_principal))
            .map(|info| matches!(info.status, MinerStatus::Active))
            .unwrap_or(false)
    });

    if !is_active_miner {
        return Err(SolutionError::UnauthorizedMiner);
    }

    let current_block = match memory::with_current_block(|block_opt| block_opt.clone()) {
        Some(block) => block,
        None => return Err(SolutionError::NoBlockToMine),
    };

    if !current_block.verify_solution(nonce, solution_hash) {
        return Err(SolutionError::VerificationFailed);
    }

    let new_solution = StorableSolution {
        nonce,
        hash: solution_hash,
        block_height: current_block.height,
        timestamp: current_time_ns,
    };

    let needs_precise_check = memory::with_solution_bloom_filter(|bloom_filter| {
        bloom_filter.might_contain(&new_solution)
    });

    if needs_precise_check {
        let is_duplicate = memory::with_processed_solutions(|processed_solutions| {
            processed_solutions.0.iter().any(|s|
                s.nonce == nonce && s.hash == solution_hash && s.block_height == current_block.height
            )
        });
        if is_duplicate {
            return Err(SolutionError::DuplicateSolution);
        }
    }

    memory::with_last_block_hash_mut(|cell| {
        cell.set(StorableHash(solution_hash))
            .map_err(|e| SolutionError::InternalError(format!("Failed to set last block hash: {:?}", e)))
    })?;

    memory::with_block_timestamps_mut(|cell| {
        let mut current_timestamps = memory::with_block_timestamps(|ts| ts.0.clone());
        current_timestamps.push(current_time_ns);
        if current_timestamps.len() > MAX_TIMESTAMPS {
            current_timestamps.remove(0);
        }
        cell.set(StorableTimestamps(current_timestamps))
            .map_err(|e| SolutionError::InternalError(format!("Failed to update timestamps: {:?}", e)))
    })?;

    memory::with_processed_solutions_mut(|cell| {
        let mut solutions = memory::with_processed_solutions(|sols| sols.0.clone());
        solutions.push(new_solution.clone());
        if solutions.len() > MAX_PROCESSED_SOLUTIONS {
            solutions.remove(0);
        }
        cell.set(StorableSolutions(solutions))
            .map_err(|e| SolutionError::InternalError(format!("Failed to update processed solutions: {:?}", e)))
    })?;

    memory::with_solution_bloom_filter_mut(|cell| {
        let mut bloom_filter = memory::with_solution_bloom_filter(|bf| bf.clone());
        bloom_filter.add(&new_solution);
        cell.set(bloom_filter)
             .map_err(|e| SolutionError::InternalError(format!("Failed to update bloom filter: {:?}", e)))
    })?;

    crate::mining::HEARTBEAT_COUNTER.with(|c| *c.borrow_mut() = 0);

    let reward = calculate_block_reward(current_block.height);

    if reward > 0 {
        update_miner_stats(miner_principal, reward);
        update_circulating_supply(reward);
    }

    ic_cdk::println!(
        "Solution accepted for block {} by {}. Reward: {}",
        current_block.height,
        miner_principal.to_text(),
        reward
    );

    match generate_new_block().await {
        Ok(next_block) => Ok(next_block),
        Err(e) => Err(SolutionError::InternalError(format!(
            "Solution accepted, but failed to generate next block: {}", e
        ))),
    }
}
