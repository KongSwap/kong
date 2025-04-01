use candid::Principal;
use crate::block_templates::Hash;
use crate::{transfer_to_miner, TOKEN_INFO_CELL, LEDGER_ID_CELL};
use crate::mining::{CURRENT_BLOCK, GENESIS_BLOCK_GENERATED, LAST_BLOCK_HASH, BLOCK_TIMESTAMPS, StorableHash, StorableTimestamps, PROCESSED_SOLUTIONS, StorableSolution, StorableSolutions, SOLUTION_BLOOM_FILTER, HEARTBEAT_COUNTER, calculate_block_reward, generate_new_block};

/// Submits a potential solution (nonce) for the current block template.
#[ic_cdk::update]
pub async fn submit_solution(
    ledger_id: Principal,
    nonce: u64,
    solution_hash: Hash,
) -> Result<(bool, u64, u64, String), String> { // Returns (success, block_height, reward, ticker)

    // --- Pre-checks ---
    let caller = ic_cdk::caller();

    // Check ledger deployment status
    let stored_ledger_id = LEDGER_ID_CELL.with(|id| id.borrow().get().as_ref().map(|p| p.0));
    match stored_ledger_id {
        None => return Err("Mining not available: Ledger ID not set.".to_string()),
        Some(id) if id != ledger_id => {
            return Err(format!(
                "Invalid ledger ID provided. Expected {}, got {}.",
                id.to_text(), ledger_id.to_text()
            ));
        }
        Some(_) => {} // Ledger ID matches, proceed
    }

    // Get current block template
    let current_block = CURRENT_BLOCK.with(|b| b.borrow().get().clone())
        .ok_or_else(|| "No block template available to mine. Genesis not created or previous block just mined?".to_string())?;

    // Store details needed for checks and potential success
    let mined_height = current_block.height;
    let ticker = TOKEN_INFO_CELL.with(|t| t.borrow().get().as_ref().map_or("?".to_string(), |info| info.ticker.clone()));

    // --- Solution Verification ---
    if !current_block.verify_solution(nonce, solution_hash) {
         ic_cdk::println!("Miner {} submitted invalid solution for block {}", caller, mined_height);
        return Ok((false, mined_height, 0, ticker));
    }

    // --- Process Valid, New Solution ---
    ic_cdk::println!("Miner {} found valid solution for block {}", caller, mined_height);
    let solution_timestamp_ns = ic_cdk::api::time();

    // Add to processed solutions and bloom filter
    let processed_solution = StorableSolution {
        nonce, hash: solution_hash, block_height: mined_height, timestamp: solution_timestamp_ns
    };

    PROCESSED_SOLUTIONS.with(|solutions| {
        let mut sols = solutions.borrow_mut();
        let mut data = sols.get().0.clone();
        const MAX_PROCESSED_SOLUTIONS: usize = 100;
        if data.len() >= MAX_PROCESSED_SOLUTIONS { data.remove(0); }
        data.push(processed_solution.clone());
        sols.set(StorableSolutions(data)).expect("Failed to update processed solutions");
    });

    // Update block timestamps
    BLOCK_TIMESTAMPS.with(|ts| {
        let mut timestamps = ts.borrow_mut();
        let mut data = timestamps.get().0.clone();
        const MAX_TIMESTAMPS: usize = 1000;
        if data.len() >= MAX_TIMESTAMPS { data.remove(0); }
        data.push(solution_timestamp_ns);
        timestamps.set(StorableTimestamps(data)).expect("Failed to update block timestamps");
    });

    // Update last block hash
    LAST_BLOCK_HASH.with(|h| {
        h.borrow_mut().set(StorableHash(solution_hash)).expect("Failed to update last block hash");
    });

    // Calculate and process reward
    let reward = calculate_block_reward(mined_height);
    if reward > 0 {
        match transfer_to_miner::transfer_to_miner(ledger_id, caller, reward).await {
            Ok(_) => {
                crate::update_circulating_supply(reward); // Call lib.rs function
                crate::update_miner_stats(caller, reward); // Call lib.rs function
                 ic_cdk::println!("Transferred reward {} to miner {}", reward, caller);
            }
            Err(e) => {
                ic_cdk::println!("CRITICAL: Failed to transfer reward {} to miner {}: {}", reward, caller, e);
            }
        }
    }

    // Generate the next block template
    match generate_new_block().await {
        Ok(_new_block) => {
            Ok((true, mined_height, reward, ticker))
        }
        Err(e) => {
            Err(format!("Solution accepted for block {}, reward processed (if > 0), but failed to generate next block: {}", mined_height, e))
        }
    }
}
