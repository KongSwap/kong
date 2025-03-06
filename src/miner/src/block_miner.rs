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

#[derive(Debug, Clone, Copy, PartialEq, CandidType, Serialize, Deserialize)]
pub enum MinerType {
    Lite,    // Conservative mining
    Normal,  // Balanced mining
    Premium, // Aggressive mining
}

pub struct BlockMiner {
    miner_type: MinerType,
    base_chunk_size: u64,
    speed_percentage: u8,
    tier_multipliers: [f64; 3],
    chunks_per_refresh: u64,
    last_rate_limit: Option<u64>,
    backoff_duration: u64,
    current_difficulty: u32,
    // New fields for difficulty adaptation
    difficulty_history: Vec<(u64, u32)>, // (timestamp, difficulty)
    difficulty_volatility: f64, // Measure of how rapidly difficulty is changing
    max_chunk_duration_ns: u64, // Maximum duration to mine a chunk
    stats: MiningStats,
}

impl BlockMiner {
    pub fn new(miner_type: MinerType) -> Self {
        // Fixed chunk size of 10,000 hashes regardless of miner type
        let base_chunk_size = 10000;
        
        Self {
            miner_type,
            base_chunk_size,
            speed_percentage: 100, // Default to 100%
            tier_multipliers: [1.0, 1.0, 1.0], // Default multipliers
            chunks_per_refresh: 1, // Only do one chunk per refresh
            last_rate_limit: None,
            backoff_duration: 1_000_000_000, // 1 second initial backoff
            current_difficulty: 0, // Initialize to 0 to force first update
            // Initialize new fields
            difficulty_history: Vec::with_capacity(10),
            difficulty_volatility: 0.0,
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

    #[allow(dead_code)]
    pub fn transform(&mut self, new_type: MinerType) {
        self.miner_type = new_type;
        // Set base chunk sizes for each type
        self.base_chunk_size = match new_type {
            MinerType::Lite => 100,
            MinerType::Normal => 500,
            MinerType::Premium => 2000,
        };
    }

    // Helper function to get actual chunk size based on percentage and tier
    pub fn get_current_chunk_size(&self) -> u64 {
        // Always return exactly 10,000 hashes
        10000
    }

    // Set tier multipliers
    #[allow(dead_code)]
    pub fn set_tier_multipliers(&mut self, lite: f64, normal: f64, premium: f64) {
        self.tier_multipliers = [lite, normal, premium];
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

    // Add getter/setter for difficulty
    pub fn _get_current_difficulty(&self) -> u32 {
        self.current_difficulty
    }

    pub fn set_current_difficulty(&mut self, difficulty: u32) {
        let now = ic_cdk::api::time();
        
        // Track difficulty changes to calculate volatility
        self.difficulty_history.push((now, difficulty));
        // Keep history limited to 10 entries
        if self.difficulty_history.len() > 10 {
            self.difficulty_history.remove(0);
        }
        
        // Calculate volatility based on recent difficulty changes
        if self.difficulty_history.len() >= 2 {
            let mut changes = Vec::new();
            for i in 1..self.difficulty_history.len() {
                let prev = self.difficulty_history[i-1].1 as f64;
                let curr = self.difficulty_history[i].1 as f64;
                if prev > 0.0 {
                    let change = (curr - prev).abs() / prev;
                    changes.push(change);
                }
            }
            
            if !changes.is_empty() {
                let sum: f64 = changes.iter().sum();
                self.difficulty_volatility = sum / changes.len() as f64;
                
                if self.difficulty_volatility > 0.1 {
                    ic_cdk::println!("High difficulty volatility detected: {:.2}", self.difficulty_volatility);
                }
            }
        }
        
        if difficulty != self.current_difficulty {
            ic_cdk::println!("Updating difficulty from {} to {}", self.current_difficulty, difficulty);
            self.current_difficulty = difficulty;
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
        
        // Always use exactly 10,000 hashes
        let current_chunk_size = 10000;

        // Increment chunks processed counter
        self.stats.chunks_since_refresh += 1;

        // Simplified logging - only log once per chunk
        ic_cdk::println!("[{:?} Miner] Mining block {} - {} total hashes, {:.0} hash/s, fixed 10k hashes", 
            self.miner_type,
            block_height, 
            self.stats.total_hashes,
            self.stats.last_hash_rate
        );
        
        // No need for periodic checks since we're doing exactly 10k hashes
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
    
    /// Enables high volatility mode, which reduces chunk sizes to respond more quickly
    /// to difficulty changes
    pub fn enable_high_volatility_mode(&mut self, enabled: bool) {
        if enabled {
            // Store original values in difficulty_history to restore later if needed
            self.difficulty_volatility = 0.5; // High value to start with
            ic_cdk::println!("High volatility mode enabled, chunk sizes will be reduced");
        } else {
            self.difficulty_volatility = 0.0;
            ic_cdk::println!("High volatility mode disabled");
        }
    }
}
