use candid::{decode_one, encode_one, CandidType, Deserialize, Principal};
use ic_stable_structures::{storable::Bound, Storable};
use std::borrow::Cow;

use super::canister::*;

// Error types
#[derive(CandidType, Deserialize, Debug)]
pub enum DelegationError {
    InvalidRequest(String),
    Expired,
    NotFound,
    StorageError(String),
    Unauthorized,
}

// ICRC-34 Types and Functions
#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct DelegationRequest {
    pub targets: Vec<Principal>,
    pub expiration: Option<u64>, // Unix timestamp in nanoseconds
}

impl DelegationRequest {
    pub fn validate(&self) -> Result<(), DelegationError> {
        if self.targets.is_empty() {
            return Err(DelegationError::InvalidRequest("No targets specified".to_string()));
        }

        if let Some(exp) = self.expiration {
            let current_time = get_current_time();
            if exp <= current_time {
                return Err(DelegationError::InvalidRequest("Expiration time must be in the future".to_string()));
            }
        }

        Ok(())
    }

    pub fn compute_targets_hash(&self) -> Vec<u8> {
        let mut targets = self.targets.clone();
        targets.sort();
        hash_principals(&targets)
    }
}

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct DelegationResponse {
    pub delegations: Vec<Delegation>,
}

#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct Delegation {
    pub target: Principal,
    pub created: u64,               // Unix timestamp in nanoseconds
    pub expiration: Option<u64>,    // Unix timestamp in nanoseconds
    pub targets_list_hash: Vec<u8>, // Hash of the sorted list of targets
}

impl Delegation {
    pub fn is_expired(&self) -> bool {
        if let Some(exp) = self.expiration {
            let current_time = get_current_time();
            exp <= current_time
        } else {
            false
        }
    }
}

// Implement Storable for Delegation
impl Storable for Delegation {
    fn to_bytes(&self) -> Cow<[u8]> {
        let bytes = candid::encode_one(self).unwrap();
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        candid::decode_one(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

#[derive(CandidType, Deserialize, Debug)]
pub struct RevokeDelegationRequest {
    pub targets: Vec<Principal>,
}

// Wrapper type for Vec<Delegation> that implements Storable
#[derive(Debug, Clone)]
pub struct DelegationVec(Vec<Delegation>);

impl DelegationVec {
    fn new() -> Self {
        Self(Vec::new())
    }

    pub fn push(&mut self, delegation: Delegation) {
        self.0.push(delegation);
    }

    pub fn retain<F>(&mut self, f: F)
    where
        F: FnMut(&Delegation) -> bool,
    {
        self.0.retain(f);
    }

    fn into_vec(self) -> Vec<Delegation> {
        self.0
    }

    pub fn as_vec(&self) -> &Vec<Delegation> {
        &self.0
    }
}

impl Default for DelegationVec {
    fn default() -> Self {
        Self::new()
    }
}

impl Storable for DelegationVec {
    fn to_bytes(&self) -> Cow<[u8]> {
        let bytes = encode_one(&self.0).unwrap();
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        Self(decode_one(&bytes).unwrap())
    }

    const BOUND: Bound = Bound::Unbounded;
}
