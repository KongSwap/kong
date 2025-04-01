// src/token_backend/src/block_templates.rs

use candid::CandidType;
use serde::{Deserialize, Serialize};
use ic_cdk::api::time;
use sha2::{Sha256, Digest};
use ic_stable_structures::{Storable, storable::Bound};
use std::borrow::Cow;
use ciborium;

pub type Hash = [u8; 32];

#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
pub struct BlockTemplate {
    pub version: u32,
    pub height: u64,
    pub prev_hash: Hash,
    pub timestamp: u64,
    pub merkle_root: Hash,
    pub difficulty: u32,
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
        difficulty: u32,
    ) -> Self {
        let timestamp = time() / 1_000_000_000; // Convert nanoseconds to seconds
        let merkle_root = Self::calculate_merkle_root();
        let target = Self::calculate_target(difficulty);

        Self {
            version: 1,
            height,
            prev_hash,
            timestamp,
            merkle_root,
            difficulty,
            target,
            nonce: 0,
        }
    }

    fn calculate_merkle_root() -> Hash {
        [0u8; 32] // Return a default hash
    }

    // Added missing function needed for verification
    pub fn calculate_hash(&self, nonce: u64) -> Hash {
        let mut hasher = Sha256::new();
        hasher.update(&self.version.to_le_bytes());
        hasher.update(&self.height.to_le_bytes());
        hasher.update(&self.prev_hash);
        hasher.update(&self.merkle_root);
        hasher.update(&self.timestamp.to_le_bytes());
        hasher.update(&self.difficulty.to_le_bytes());
        hasher.update(&nonce.to_le_bytes()); // Use the provided nonce
        let result = hasher.finalize();
        let mut hash = [0u8; 32];
        hash.copy_from_slice(&result[..]);
        hash
    }

    pub fn verify_solution(&self, nonce: u64, solution_hash: Hash) -> bool {
        let calculated_hash = self.calculate_hash(nonce); // Now calls the added function
        if calculated_hash != solution_hash {
            return false;
        }
        
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
        max_size: 1024 * 64,
        is_fixed_size: false,
    };
}