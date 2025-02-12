use candid::{CandidType, Deserialize, Principal, encode_one, decode_one};
use ic_cdk::{caller, query, update};
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap, Storable};
use std::cell::RefCell;
use std::time::{SystemTime, UNIX_EPOCH};
use ic_stable_structures::storable::Bound;
use std::borrow::Cow;

// We'll implement our own simple hash function since we don't have sha2
fn hash_principals(principals: &[Principal]) -> Vec<u8> {
    let mut result = Vec::new();
    for principal in principals {
        result.extend_from_slice(principal.as_slice());
    }
    result
}

// Memory configuration
const DELEGATION_MEMORY_ID: MemoryId = MemoryId::new(3);

// Error types
#[derive(CandidType, Deserialize, Debug)]
pub enum DelegationError {
    InvalidRequest(String),
    Expired,
    NotFound,
    StorageError(String),
    Unauthorized,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct ICRC21ConsentMessageRequest {
    pub canister: candid::Principal,
    pub method: String,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct ICRC21ConsentMessageResponse {
    pub consent_message: String,
}

/// Generates a consent message for ICRC-21 canister calls
/// This follows the specification from https://github.com/dfinity/wg-identity-authentication/blob/main/topics/ICRC-21/icrc_21_consent_msg.md
#[query]
pub fn icrc21_canister_call_consent_message(request: ICRC21ConsentMessageRequest) -> ICRC21ConsentMessageResponse {
    let caller_principal = caller();
    let consent_message = format!(
        "By signing this message, I confirm that I want to call the '{}' method on the '{}' canister on behalf of principal '{}'.",
        request.method,
        request.canister,
        caller_principal
    );

    ICRC21ConsentMessageResponse { consent_message }
}

// ICRC-34 Types and Functions
#[derive(CandidType, Deserialize, Debug, Clone)]
pub struct DelegationRequest {
    pub targets: Vec<Principal>,
    pub expiration: Option<u64>, // Unix timestamp in nanoseconds
}

impl DelegationRequest {
    fn validate(&self) -> Result<(), DelegationError> {
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

    fn compute_targets_hash(&self) -> Vec<u8> {
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
    pub created: u64,  // Unix timestamp in nanoseconds
    pub expiration: Option<u64>,  // Unix timestamp in nanoseconds
    pub targets_list_hash: Vec<u8>, // Hash of the sorted list of targets
}

impl Delegation {
    fn is_expired(&self) -> bool {
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

    const BOUND: ic_stable_structures::storable::Bound = ic_stable_structures::storable::Bound::Unbounded;
}

#[derive(CandidType, Deserialize, Debug)]
pub struct RevokeDelegationRequest {
    pub targets: Vec<Principal>,
}

// Helper function to get current time in nanoseconds
fn get_current_time() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos() as u64
}

// Wrapper type for Vec<Delegation> that implements Storable
#[derive(Debug, Clone)]
pub struct DelegationVec(Vec<Delegation>);

impl DelegationVec {
    fn new() -> Self {
        Self(Vec::new())
    }

    fn push(&mut self, delegation: Delegation) {
        self.0.push(delegation);
    }

    fn retain<F>(&mut self, f: F)
    where
        F: FnMut(&Delegation) -> bool,
    {
        self.0.retain(f);
    }

    fn into_vec(self) -> Vec<Delegation> {
        self.0
    }

    fn as_vec(&self) -> &Vec<Delegation> {
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

// Stable storage for delegations
thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
        MemoryManager::init(DefaultMemoryImpl::default())
    );

    static DELEGATIONS: RefCell<StableBTreeMap<Principal, DelegationVec, VirtualMemory<DefaultMemoryImpl>>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(DELEGATION_MEMORY_ID))
        )
    );
}

/// Returns current delegations for the caller that match the requested targets
#[query]
pub fn icrc_34_get_delegation(request: DelegationRequest) -> Result<DelegationResponse, DelegationError> {
    request.validate()?;
    
    let caller_principal = caller();
    let targets_hash = request.compute_targets_hash();
    
    let delegations = DELEGATIONS.with(|store| {
        store.borrow()
            .get(&caller_principal)
            .map(|d| d.as_vec().clone())
            .unwrap_or_default()
            .into_iter()
            .filter(|d| !d.is_expired() && d.targets_list_hash == targets_hash)
            .collect::<Vec<_>>()
    });
    
    Ok(DelegationResponse { delegations })
}

/// Creates a new delegation for the specified targets
#[update]
pub fn icrc_34_delegate(request: DelegationRequest) -> Result<DelegationResponse, DelegationError> {
    request.validate()?;
    
    let caller_principal = caller();
    let current_time = get_current_time();
    let targets_hash = request.compute_targets_hash();
    
    let delegation = Delegation {
        target: caller_principal,
        created: current_time,
        expiration: request.expiration,
        targets_list_hash: targets_hash,
    };
    
    DELEGATIONS.with(|store| {
        let mut store = store.borrow_mut();
        let mut user_delegations = store.get(&caller_principal).unwrap_or_default();
        
        // Remove expired delegations
        user_delegations.retain(|d| !d.is_expired());
        
        // Add new delegation
        user_delegations.push(delegation.clone());
        
        store.insert(caller_principal, user_delegations);
        Ok(DelegationResponse {
            delegations: vec![delegation]
        })
    })
}

/// Revokes delegations for the specified targets
#[update]
pub fn icrc_34_revoke_delegation(request: RevokeDelegationRequest) -> Result<(), DelegationError> {
    if request.targets.is_empty() {
        return Err(DelegationError::InvalidRequest("No targets specified".to_string()));
    }
    
    let caller_principal = caller();
    let targets_hash = {
        let mut targets = request.targets;
        targets.sort();
        hash_principals(&targets)
    };
    
    DELEGATIONS.with(|store| {
        let mut store = store.borrow_mut();
        let mut user_delegations = store.get(&caller_principal).unwrap_or_default();
        
        // Remove delegations with matching hash
        user_delegations.retain(|d| d.targets_list_hash != targets_hash);
        
        store.insert(caller_principal, user_delegations);
        Ok(())
    })
}
