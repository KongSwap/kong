// src/miner/src/block_miner.rs

use candid::{CandidType, Principal};
use ic_cdk::api::time;
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

#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
pub struct MiningResult {
    pub block_height: u64,
    pub nonce: u64,
    pub solution_hash: Hash,
    pub miner: Principal,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, CandidType, Serialize, Deserialize)]
pub enum MinerType {
    Lite,    // Conservative mining
    Normal,  // Balanced mining
    Premium, // Aggressive mining
}

pub struct BlockMiner {
    stats: MiningStats,
    base_chunk_size: u64,
    speed_percentage: u8,
    miner_type: MinerType,
    chunks_per_refresh: u64,
    current_difficulty: u32, // Track current difficulty
    last_rate_limit: Option<u64>,
    backoff_duration: u64,
}

impl BlockMiner {
    pub fn new(chunk_size: u64) -> Self {
        Self {
            stats: MiningStats {
                blocks_mined: 0,
                total_hashes: 0,
                start_time: time(),
                last_hash_rate: 0.0,
                total_rewards: 0,
                chunks_since_refresh: 0,
            },
            base_chunk_size: chunk_size,
            speed_percentage: 100,
            miner_type: MinerType::Normal,
            chunks_per_refresh: 5, // Default to 5 chunks per refresh
            current_difficulty: 0, // Initialize to 0 to force first update
            last_rate_limit: None,
            backoff_duration: 10_000_000_000, // Reset to 10 seconds
        }
    }

    pub fn get_stats(&self) -> MiningStats {
        self.stats.clone()
    }

    pub fn get_stats_mut(&mut self) -> &mut MiningStats {
        &mut self.stats
    }

    pub fn get_type(&self) -> MinerType {
        self.miner_type
    }

    pub fn get_speed_percentage(&self) -> u8 {
        self.speed_percentage
    }

    pub fn set_speed_percentage(&mut self, percentage: u8) {
        assert!(percentage >= 1 && percentage <= 100, "Speed percentage must be between 1 and 100");
        self.speed_percentage = percentage;
    }

    pub fn transform(&mut self, new_type: MinerType) {
        self.miner_type = new_type;
        // Set base chunk sizes for each type
        self.base_chunk_size = match new_type {
            MinerType::Lite => 25_000,    // 25K hashes per chunk
            MinerType::Normal => 50_000,   // 50K hashes per chunk
            MinerType::Premium => 100_000, // 100K hashes per chunk
        };
    }

    // Helper function to get actual chunk size based on percentage
    pub fn get_current_chunk_size(&self) -> u64 {
        (self.base_chunk_size as f64 * (self.speed_percentage as f64 / 100.0)) as u64
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
    pub fn needs_template_refresh(&self) -> bool {
        self.stats.chunks_since_refresh >= self.chunks_per_refresh
    }

    /// Resets the chunk counter, typically called after getting a fresh template
    pub fn reset_chunk_counter(&mut self) {
        self.stats.chunks_since_refresh = 0;
    }

    // Add getter/setter for difficulty
    pub fn _get_current_difficulty(&self) -> u32 {
        self.current_difficulty
    }

    pub fn set_current_difficulty(&mut self, difficulty: u32) {
        if difficulty != self.current_difficulty {
            ic_cdk::println!("Updating difficulty from {} to {}", self.current_difficulty, difficulty);
            self.current_difficulty = difficulty;
            // Reset chunk counter on difficulty change
            self.stats.chunks_since_refresh = 0;
        }
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
        let current_chunk_size = self.get_current_chunk_size();

        // Increment chunks processed counter
        self.stats.chunks_since_refresh += 1;

        // Log based on chunk size and miner type
        let log_interval = match self.miner_type {
            MinerType::Lite => current_chunk_size,      // Log every chunk
            MinerType::Normal => current_chunk_size * 2, // Log every 2 chunks
            MinerType::Premium => current_chunk_size * 4 // Log every 4 chunks
        };
        
        if self.stats.total_hashes % log_interval == 0 {
            let elapsed = (ic_cdk::api::time() - chunk_start_time) as f64 / 1_000_000_000.0;
            // Only calculate and log rate if we have a meaningful elapsed time
            if elapsed >= 0.001 { // Minimum 1ms elapsed time
                // Calculate rate for this chunk
                let chunk_hash_rate = current_chunk_size as f64 / elapsed;
                
                // Update running average with 90% old rate, 10% new rate
                self.stats.last_hash_rate = (self.stats.last_hash_rate * 0.9) + (chunk_hash_rate * 0.1);
                
                ic_cdk::println!("[{:?} Miner @ {}%] Block {} - {} hashes processed, {:.0} hash/s, chunks since refresh: {}/{}", 
                    self.miner_type,
                    self.speed_percentage,
                    block_height, 
                    self.stats.total_hashes,
                    self.stats.last_hash_rate,
                    self.stats.chunks_since_refresh,
                    self.chunks_per_refresh
                );
            } else {
                // Just log progress without rate if elapsed time is too small
                ic_cdk::println!("[{:?} Miner @ {}%] Block {} - {} hashes processed, chunks since refresh: {}/{}", 
                    self.miner_type,
                    self.speed_percentage,
                    block_height, 
                    self.stats.total_hashes,
                    self.stats.chunks_since_refresh,
                    self.chunks_per_refresh
                );
            }
        }

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
                    let chunk_hash_rate = current_chunk_size as f64 / elapsed;
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
        
        None
    }

    pub fn handle_rate_limit(&mut self) {
        let now = ic_cdk::api::time();
        
        if let Some(last_limit) = self.last_rate_limit {
            // If we got rate limited again within 60 seconds, increase backoff
            if now - last_limit < 60_000_000_000 {
                // Exponential backoff: double the wait time, cap at 30 seconds
                self.backoff_duration = (self.backoff_duration * 2).min(30_000_000_000);
            } else {
                // Reset backoff if it's been a while
                self.backoff_duration = 10_000_000_000; // Reset to 10 seconds
            }
        }
        
        self.last_rate_limit = Some(now);
        
        ic_cdk::println!(
            "[{:?} Miner] Rate limited - backing off for {:.1} seconds",
            self.miner_type,
            self.backoff_duration as f64 / 1_000_000_000.0
        );
        
        // Actually wait
        std::thread::sleep(std::time::Duration::from_nanos(self.backoff_duration));
    }
}
