// src/miner/src/block_miner.rs

use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use sha2::{Sha256, Digest};

pub type Hash = [u8; 32];

#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
pub struct MiningStats {
    pub blocks_mined: u64,
    pub total_hashes: u64,
    pub start_time: u64,
    pub last_hash_rate: f64,
    pub total_rewards: u64,
    pub chunks_since_refresh: u64,
}

impl Default for MiningStats {
    fn default() -> Self {
        Self {
            blocks_mined: 0,
            total_hashes: 0,
            start_time: ic_cdk::api::time(),
            last_hash_rate: 0.0,
            total_rewards: 0,
            chunks_since_refresh: 0,
        }
    }
}

#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
pub struct MiningResult {
    pub block_height: u64,
    pub nonce: u64,
    pub solution_hash: Hash,
    pub miner: Principal,
    pub timestamp: u64,
}

pub struct BlockMiner {
    base_chunk_size: u64,
    speed_percentage: u8,
    chunks_per_refresh: u64,
    max_chunk_duration_ns: u64, // Maximum duration to mine a chunk
    stats: MiningStats,
}

impl BlockMiner {
    pub fn new() -> Self {
        // Default chunk size of 1,000 hashes
        let base_chunk_size = 1000;
        
        Self {
            base_chunk_size,
            speed_percentage: 100, // Default to 100%
            chunks_per_refresh: 1, // Only do one chunk per refresh
            max_chunk_duration_ns: 2_000_000_000, // 2 seconds max chunk duration
            stats: MiningStats::default(),
        }
    }

    pub fn get_stats(&self) -> MiningStats {
        self.stats.clone()
    }

    pub fn get_stats_mut(&mut self) -> &mut MiningStats {
        &mut self.stats
    }

    pub fn get_speed_percentage(&self) -> u8 {
        self.speed_percentage
    }

    pub fn set_speed_percentage(&mut self, percentage: u8) {
        assert!(percentage >= 1 && percentage <= 100, "Speed percentage must be between 1 and 100");
        self.speed_percentage = percentage;
    }

    // Helper function to get actual chunk size based on percentage
    pub fn get_current_chunk_size(&self) -> u64 {
        // Return the configured base chunk size
        self.base_chunk_size
    }

    // Set chunk size with validation
    pub fn set_chunk_size(&mut self, size: u64) -> Result<(), String> {
        if size < 1000 || size > 100000 {
            return Err("Chunk size must be between 1,000 and 100,000 hashes".to_string());
        }
        self.base_chunk_size = size;
        ic_cdk::println!("Set chunk size to {} hashes", size);
        Ok(())
    }

    // Get current chunk size
    pub fn get_chunk_size(&self) -> u64 {
        self.base_chunk_size
    }

    /// Sets the number of chunks to process before requesting a fresh block template
    pub fn set_chunks_per_refresh(&mut self, chunks: u64) {
        assert!(chunks > 0, "Chunks per refresh must be positive");
        self.chunks_per_refresh = chunks;
    }

    /// Gets the current setting for chunks to process before template refresh
    pub fn get_chunks_per_refresh(&self) -> u64 {
        self.chunks_per_refresh
    }

    /// Returns true if enough chunks have been processed to warrant a template refresh
    #[allow(dead_code)]
    pub fn needs_template_refresh(&self) -> bool {
        self.stats.chunks_since_refresh >= self.chunks_per_refresh
    }

    /// Resets the chunk counter, typically called after getting a fresh template
    #[allow(dead_code)]
    pub fn reset_chunk_counter(&mut self) {
        self.stats.chunks_since_refresh = 0;
    }

    pub fn mine_block_chunk(
        &mut self,
        block_height: u64,
        prev_hash: Hash,
        target: Hash,
        start_nonce: u64,
        version: u32,
        merkle_root: Hash,
        timestamp: u64,
        difficulty: u32,
    ) -> Option<MiningResult> {
        let mut hasher = Sha256::new();
        let chunk_start_time = ic_cdk::api::time();
        
        // Use the configured chunk size
        let current_chunk_size: u64 = self.get_current_chunk_size();

        // Increment chunks processed counter
        self.stats.chunks_since_refresh += 1;

        // Simplified logging - only log once per chunk
        ic_cdk::println!("Mining block {} - {} total hashes, {:.0} hash/s, chunk size: {} hashes", 
            block_height, 
            self.stats.total_hashes,
            self.stats.last_hash_rate,
            current_chunk_size
        );
        
        // No need for periodic checks since we're doing a fixed number of hashes
        for nonce in start_nonce..start_nonce + current_chunk_size {
            hasher.update(&version.to_le_bytes());
            hasher.update(&block_height.to_le_bytes());
            hasher.update(&prev_hash);
            hasher.update(&merkle_root);
            hasher.update(&timestamp.to_le_bytes());
            hasher.update(&difficulty.to_le_bytes());
            hasher.update(&nonce.to_le_bytes());
            
            let result = hasher.finalize_reset();
            let hash: Hash = result.into();
            
            self.stats.total_hashes += 1;
            
            if hash <= target {
                self.stats.blocks_mined += 1;
                
                // Reset chunk counter on successful mining
                self.stats.chunks_since_refresh = 0;
                
                // Update final hashrate using exponential moving average
                let elapsed = (ic_cdk::api::time() - chunk_start_time) as f64 / 1_000_000_000.0;
                if elapsed >= 0.001 { // Same minimum elapsed time check
                    let chunk_hash_rate = (nonce - start_nonce + 1) as f64 / elapsed;
                    self.stats.last_hash_rate = (self.stats.last_hash_rate * 0.9) + (chunk_hash_rate * 0.1);
                }
                
                return Some(MiningResult {
                    block_height,
                    nonce,
                    solution_hash: hash,
                    miner: ic_cdk::api::id(),
                    timestamp: ic_cdk::api::time(),
                });
            }
        }
        
        // Update hash rate at the end of each chunk
        let elapsed = (ic_cdk::api::time() - chunk_start_time) as f64 / 1_000_000_000.0;
        if elapsed >= 0.001 {
            let chunk_hash_rate = current_chunk_size as f64 / elapsed;
            self.stats.last_hash_rate = (self.stats.last_hash_rate * 0.9) + (chunk_hash_rate * 0.1);
        }
        
        None
    }

    /// Sets the maximum duration a chunk can mine before returning to check for updates
    pub fn set_max_chunk_duration(&mut self, seconds: u64) {
        assert!(seconds > 0, "Max chunk duration must be positive");
        self.max_chunk_duration_ns = seconds * 1_000_000_000; // Convert to nanoseconds
        ic_cdk::println!("Set max chunk duration to {}s", seconds);
    }
    
    /// Gets the current maximum chunk duration in seconds
    #[allow(dead_code)]
    pub fn get_max_chunk_duration_seconds(&self) -> u64 {
        self.max_chunk_duration_ns / 1_000_000_000
    }
}
