// src/token_backend/src/block_templates.rs

use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};
use ic_cdk::api::time;
use sha2::{Sha256, Digest};
use ic_stable_structures::{Storable, storable::Bound};
use std::borrow::Cow;
use ciborium;

pub type Hash = [u8; 32];

#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
pub enum EventType {
    // Mining related events
    DifficultyAdjustment {
        old_difficulty: u32,
        new_difficulty: u32,
        reason: String,
    },
    RewardHalving {
        new_reward: u64,
        block_height: u64,
    },
    MiningMilestone {
        miner: Principal,
        achievement: String,
        blocks_mined: u64,
    },
    
    BlockMined {
        miner: Principal,
        reward: u64,
        nonce: u64,
        hash: Hash,
    },
    
    // Competition/Game events
    LeaderboardUpdate {
        miner: Principal,
        position: u32,
        total_mined: u64,
    },
    MiningCompetition {
        winner: Principal,
        prize: u64,
        competition_id: String,
    },
    
    // System events
    VersionUpgrade {
        new_version: String,
        features: Vec<String>,
    },
    SystemAnnouncement {
        message: String,
        severity: String,
    },
    
    // Special achievements
    Achievement {
        miner: Principal,
        name: String,
        description: String,
    }

    // In the future we could add more event types like?:
    // Transfer {
    //     from: Principal,
    //     to: Principal,
    //     amount: u64,
    //     token_id: u64,
    // },
}

#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
pub struct Event {
    pub event_type: EventType,
    pub timestamp: u64,
    pub block_height: u64,
}

// Implement Storable for Event
impl Storable for Event {
    fn to_bytes(&self) -> Cow<[u8]> {
        // Pre-allocate with a reasonable capacity to avoid reallocations
        let mut bytes = Vec::with_capacity(256);
        ciborium::ser::into_writer(self, &mut bytes)
            .expect("Failed to serialize Event");
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        match bytes {
            Cow::Borrowed(bytes) => ciborium::de::from_reader(bytes)
                .expect("Failed to deserialize Event"),
            Cow::Owned(bytes) => ciborium::de::from_reader(bytes.as_slice())
                .expect("Failed to deserialize Event"),
        }
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 1024,
        is_fixed_size: false,
    };
}

// Implement Storable for EventType
impl Storable for EventType {
    fn to_bytes(&self) -> Cow<[u8]> {
        // Pre-allocate with a reasonable capacity
        let mut bytes = Vec::with_capacity(512);
        ciborium::ser::into_writer(self, &mut bytes)
            .expect("Failed to serialize EventType");
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        match bytes {
            Cow::Borrowed(bytes) => ciborium::de::from_reader(bytes)
                .expect("Failed to deserialize EventType"),
            Cow::Owned(bytes) => ciborium::de::from_reader(bytes.as_slice())
                .expect("Failed to deserialize EventType"),
        }
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 1024,
        is_fixed_size: false,
    };
}

#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
pub struct BlockTemplate {
    pub version: u32,
    pub height: u64,
    pub prev_hash: Hash,
    pub timestamp: u64,
    pub merkle_root: Hash,
    pub difficulty: u32,
    pub events: Vec<Event>,
    pub target: Hash,
    pub nonce: u64,
}

impl BlockTemplate {
    pub fn calculate_target(difficulty: u32) -> Hash {
        let mut target = [0xff; 32];
        let leading_zeros = std::cmp::min(difficulty as usize, 256); // Cap at max possible bits
        
        // Set leading zeros based on difficulty
        for i in 0..(leading_zeros/8) {
            target[i] = 0;
        }
        
        // Handle remaining bits
        if leading_zeros % 8 != 0 && (leading_zeros/8) < 32 {
            target[leading_zeros/8] = 0xff >> (leading_zeros % 8);
        }
        
        target
    }

    pub fn new(
        height: u64,
        prev_hash: Hash,
        events: Vec<Event>,
        difficulty: u32,
    ) -> Self {
        let timestamp = time() / 1_000_000_000; // Convert nanoseconds to seconds
        let merkle_root = Self::calculate_merkle_root(&events);
        let target = Self::calculate_target(difficulty);

        Self {
            version: 1,
            height,
            prev_hash,
            timestamp,
            merkle_root,
            difficulty,
            events,
            target,
            nonce: 0,
        }
    }

    fn hash_event(event: &Event) -> Hash {
        let mut hasher = Sha256::new();
        
        // Hash all event fields using ciborium
        let mut event_bytes = Vec::new();
        ciborium::ser::into_writer(event, &mut event_bytes).expect("Failed to serialize event");
        hasher.update(&event_bytes);
        
        let result = hasher.finalize();
        let mut hash = [0u8; 32];
        hash.copy_from_slice(&result[..]);
        hash
    }

    fn calculate_merkle_root(events: &[Event]) -> Hash {
        if events.is_empty() {
            return [0; 32];
        }

        // First hash all events
        let mut hashes: Vec<Hash> = events.iter()
            .map(|evt| Self::hash_event(evt))
            .collect();

        // Keep combining pairs until only root remains
        while hashes.len() > 1 {
            // If odd number, duplicate last hash
            if hashes.len() % 2 != 0 {
                hashes.push(*hashes.last().unwrap());
            }

            // Combine pairs of hashes
            let mut new_hashes = Vec::with_capacity((hashes.len() + 1) / 2);
            
            for chunk in hashes.chunks(2) {
                let mut hasher = Sha256::new();
                hasher.update(&chunk[0]);
                hasher.update(&chunk[1]);
                
                let result = hasher.finalize();
                let mut hash = [0u8; 32];
                hash.copy_from_slice(&result[..]);
                new_hashes.push(hash);
            }

            hashes = new_hashes;
        }

        hashes[0]
    }

    pub fn calculate_hash(&self, nonce: u64) -> Hash {
        let mut hasher = Sha256::new();
        
        // Hash block header fields
        hasher.update(&self.version.to_le_bytes());
        hasher.update(&self.height.to_le_bytes());
        hasher.update(&self.prev_hash);
        hasher.update(&self.merkle_root);
        hasher.update(&self.timestamp.to_le_bytes());
        hasher.update(&self.difficulty.to_le_bytes());
        hasher.update(&nonce.to_le_bytes());

        let result = hasher.finalize();
        let mut hash = [0u8; 32];
        hash.copy_from_slice(&result[..]);
        hash
    }

    pub fn verify_solution(&self, nonce: u64, solution_hash: Hash) -> bool {
        // Verify the provided solution hash matches our calculation
        let calculated_hash = self.calculate_hash(nonce);
        if calculated_hash != solution_hash {
            return false;
        }
        
        // Check if solution hash is below target (satisfies difficulty)
        solution_hash <= self.target
    }
}

// Implement Storable for BlockTemplate
impl Storable for BlockTemplate {
    fn to_bytes(&self) -> Cow<[u8]> {
        // Pre-allocate with a reasonable capacity based on typical block size
        let mut bytes = Vec::with_capacity(1024);
        ciborium::ser::into_writer(self, &mut bytes)
            .expect("Failed to serialize BlockTemplate");
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        match bytes {
            Cow::Borrowed(bytes) => ciborium::de::from_reader(bytes)
                .expect("Failed to deserialize BlockTemplate"),
            Cow::Owned(bytes) => ciborium::de::from_reader(bytes.as_slice())
                .expect("Failed to deserialize BlockTemplate"),
        }
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 1024 * 64, // 64KB should be enough for a block template
        is_fixed_size: false,
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_block_template_creation() {
        let prev_hash = [0; 32];
        let events = vec![];
        let difficulty = 4;

        let template = BlockTemplate::new(1, prev_hash, events, difficulty);
        
        assert_eq!(template.version, 1);
        assert_eq!(template.height, 1);
        assert_eq!(template.prev_hash, prev_hash);
        assert!(template.timestamp > 0);
    }

    #[test]
    fn test_difficulty_target() {
        let template = BlockTemplate::new(1, [0; 32], vec![], 16);
        
        // First two bytes should be 0 for difficulty 16
        assert_eq!(template.target[0], 0);
        assert_eq!(template.target[1], 0);
        assert_eq!(template.target[2], 0xff);
    }

    #[test]
    fn test_merkle_root_empty() {
        let events = vec![];
        let root = BlockTemplate::calculate_merkle_root(&events);
        assert_eq!(root, [0; 32]);
    }

    #[test]
    fn test_merkle_root_single_event() {
        let event = Event {
            event_type: EventType::SystemAnnouncement {
                message: "Test announcement".to_string(),
                severity: "info".to_string(),
            },
            timestamp: 12345,
            block_height: 1,
        };
        
        let events = vec![event];
        let root = BlockTemplate::calculate_merkle_root(&events);
        assert_ne!(root, [0; 32]); // Should produce a non-zero hash
    }

    #[test]
    fn test_solution_verification() {
        let template = BlockTemplate::new(1, [0; 32], vec![], 1); // Very low difficulty for testing
        
        let nonce = 12345u64;
        let hash = template.calculate_hash(nonce);
        
        assert!(template.verify_solution(nonce, hash));
        
        // Test invalid nonce
        let wrong_nonce = 54321u64;
        assert!(!template.verify_solution(wrong_nonce, hash));
    }
} 
