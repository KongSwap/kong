use candid::{CandidType, Deserialize, Principal};
use ic_cdk::api;
use std::cell::RefCell;
use ic_stable_structures::{
    memory_manager::{MemoryManager, MemoryId, VirtualMemory},
    DefaultMemoryImpl, StableBTreeMap, Storable, storable::Bound
};
use std::borrow::Cow;

// ICRC-28 and ICRC-10 data structures
#[derive(CandidType, Deserialize)]
pub struct TrustedOriginsResponse {
    pub trusted_origins: Vec<String>,
}

#[derive(CandidType, Deserialize)]
pub struct SupportedStandard {
    pub name: String,
    pub url: String,
}

// Static list of trusted frontend origins
const STATIC_ORIGINS: &[&str] = &[
    "https://edoy4-liaaa-aaaar-qakha-cai.localhost:5173",
    "http://localhost:5173",
    "https://kongswap.io",
    "https://www.kongswap.io", 
    "https://edoy4-liaaa-aaaar-qakha-cai.icp0.io",
    "https://dev.kongswap.io",
];

// Function to get all trusted origins including dynamic ones
fn get_trusted_origins() -> Vec<String> {
    let mut origins: Vec<String> = STATIC_ORIGINS.iter().map(|s| s.to_string()).collect();
    // Add dynamic canister-specific origin
    origins.push(format!("https://{}.icp0.io", api::id().to_string()));
    origins
}

// Security constants for delegation and rate limiting
const MAX_DELEGATION_DURATION_NS: u64 = 86_400_000_000_000; // 24 hours in nanoseconds
const METHOD_NAME_MAX_LENGTH: usize = 100; // Maximum allowed method name length
const MINIMUM_DELEGATION_DURATION_NS: u64 = 60_000_000_000; // 1 minute minimum delegation duration
const MAX_FAILED_ATTEMPTS: u32 = 5; // Maximum failed attempts before rate limiting
const RATE_LIMIT_WINDOW_NS: u64 = 60_000_000_000; // 1 minute rate limit window

// Error types for delegation and consent operations
#[derive(Debug, CandidType, Deserialize)]
pub enum DelegationError {
    Anonymous,
    InvalidExpiry { provided: u64, current: u64, max: u64 },
    InvalidDelegationId { expected: Vec<u8>, provided: Vec<u8> },
    RateLimitExceeded { next_allowed: u64 },
    SystemError(String),
    Unauthorized(String),
}

#[derive(Debug, CandidType, Deserialize)]
pub enum ConsentError {
    MethodTooLong { length: usize, max: usize },
    InvalidMethod(String),
    InvalidArguments(String),
    AmountExceeded { amount: u64, max: u64 },
    SystemError(String),
}

thread_local! {
    // Memory manager for stable storage
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
        MemoryManager::init(DefaultMemoryImpl::default())
    );

    // Stable storage for delegation data
    static DELEGATIONS: RefCell<StableBTreeMap<StorablePrincipal, DelegationData, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(22)))
        )
    );

    // Stable storage for rate limiting data
    static FAILED_ATTEMPTS: RefCell<StableBTreeMap<StorablePrincipal, (u32, u64), Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(23)))
        )
    );
}

type Memory = VirtualMemory<DefaultMemoryImpl>;

// Initialize the standards module
pub(crate) fn init() {
    ic_cdk::println!("Initializing standards module");
}

// Wrapper for Principal to implement Storable
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
struct StorablePrincipal(Principal);

impl Storable for StorablePrincipal {
    fn to_bytes(&self) -> Cow<[u8]> {
        let mut bytes = vec![0u8; 32];
        let principal_bytes = self.0.as_slice();
        bytes[..principal_bytes.len()].copy_from_slice(principal_bytes);
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        // Take only the non-zero bytes for the principal
        let mut actual_bytes = bytes.as_ref().to_vec();
        while let Some(&0) = actual_bytes.last() {
            actual_bytes.pop();
        }
        Self(Principal::from_slice(&actual_bytes))
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 32,
        is_fixed_size: true,
    };
}

impl From<Principal> for StorablePrincipal {
    fn from(p: Principal) -> Self {
        Self(p)
    }
}

// Data structure for storing delegation information
#[derive(Clone, Debug)]
struct DelegationData {
    expiry: u64,
    delegation_id: Vec<u8>,
    created_at: u64,
    last_used: u64,
    use_count: u64,
}

impl Storable for DelegationData {
    fn to_bytes(&self) -> Cow<[u8]> {
        let mut bytes = Vec::with_capacity(40 + self.delegation_id.len());
        bytes.extend_from_slice(&self.expiry.to_be_bytes());
        bytes.extend_from_slice(&self.created_at.to_be_bytes());
        bytes.extend_from_slice(&self.last_used.to_be_bytes());
        bytes.extend_from_slice(&self.use_count.to_be_bytes());
        bytes.extend_from_slice(&(self.delegation_id.len() as u32).to_be_bytes());
        bytes.extend_from_slice(&self.delegation_id);
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        let expiry = u64::from_be_bytes(bytes[0..8].try_into().expect("Invalid expiry bytes"));
        let created_at = u64::from_be_bytes(bytes[8..16].try_into().expect("Invalid created_at bytes"));
        let last_used = u64::from_be_bytes(bytes[16..24].try_into().expect("Invalid last_used bytes"));
        let use_count = u64::from_be_bytes(bytes[24..32].try_into().expect("Invalid use_count bytes"));
        let id_len = u32::from_be_bytes(bytes[32..36].try_into().expect("Invalid id_len bytes")) as usize;
        let delegation_id = bytes[36..36+id_len].to_vec();
        
        Self { 
            expiry, 
            delegation_id, 
            created_at, 
            last_used, 
            use_count 
        }
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 256,
        is_fixed_size: false,
    };
}

// Public types for Candid interface
#[derive(CandidType, Deserialize)]
pub struct ConsentMessageRequest {
    pub method: String,
    pub arg: Vec<u8>,
    pub consent_preferences: ConsentPreferences,
}

#[derive(CandidType, Deserialize)]
pub struct ConsentPreferences {
    pub language: String,
}

#[derive(CandidType, Deserialize)]
pub enum ConsentMessageResponse {
    Ok { 
        consent_message: String, 
        language: String 
    },
    Err { 
        error_code: u32, 
        error_message: String 
    },
}

// Change to query since it's read-only and doesn't need consensus
#[ic_cdk::query]
pub fn icrc21_consent_message(req: ConsentMessageRequest) -> ConsentMessageResponse {
    let _caller = api::caller();
    
    if req.method.len() > METHOD_NAME_MAX_LENGTH {
        return ConsentMessageResponse::Err { 
            error_code: 1,
            error_message: format!("Method name exceeds security bounds (max: {})", METHOD_NAME_MAX_LENGTH)
        };
    }

    match req.method.as_str() {
        "register_miner" => {
            ConsentMessageResponse::Ok {
                consent_message: "Request to register as a miner on the network. No fee required.".to_string(),
                language: "en-US".to_string(),
            }
        },
        "submit_solution" => {
            ConsentMessageResponse::Ok {
                consent_message: "Submitting a mining solution for verification.".to_string(),
                language: "en-US".to_string(),
            }
        },
        "deregister_miner" => {
            ConsentMessageResponse::Ok {
                consent_message: "WARNING: You are about to deregister as a miner. This will stop your mining activities and affect your mining status.".to_string(),
                language: "en-US".to_string(),
            }
        },
        "icrc34_delegate" => {
            match candid::decode_one::<DelegationRequest>(&req.arg) {
                Ok(args) => ConsentMessageResponse::Ok {
                    consent_message: format!(
                        "Delegating permissions to principal {}. This delegation will expire after {} hours. This action cannot be undone until expiration.",
                        args.delegatee.to_text(),
                        (args.expiry - api::time()) / 3_600_000_000_000
                    ),
                    language: "en-US".to_string(),
                },
                Err(_) => ConsentMessageResponse::Err {
                    error_code: 2,
                    error_message: "Invalid delegation arguments".to_string()
                }
            }
        },
        "start_token" => {
            ConsentMessageResponse::Ok {
                consent_message: "CRITICAL ACTION: Initializing the token ledger canister. This action is irreversible and will deploy the ICRC token contract.".to_string(),
                language: "en-US".to_string(),
            }
        },
        "cleanup_expired_delegations" => {
            ConsentMessageResponse::Ok {
                consent_message: "You are about to clean up expired delegations. This will remove all expired delegation records from the system.".to_string(),
                language: "en-US".to_string(),
            }
        },
        _ => ConsentMessageResponse::Err {
            error_code: 3,
            error_message: format!("Unauthorized method: {}", req.method),
        }
    }
}

#[derive(CandidType, Deserialize)]
pub struct DelegationRequest {
    pub delegatee: Principal,
    pub expiry: u64,
}

#[derive(CandidType, Deserialize)]
pub enum DelegationResponse {
    Ok {
        delegation_id: Vec<u8>,
        expiry: u64,
    },
    Err {
        error_code: u32,
        error_message: String,
    }
}

#[ic_cdk::update]
pub async fn icrc34_delegate(req: DelegationRequest) -> Result<DelegationResponse, DelegationError> {
    let caller = api::caller();
    
    if caller == Principal::anonymous() {
        return Err(DelegationError::Anonymous);
    }

    check_rate_limit(&caller)?;

    let current_time = api::time();
    if req.expiry <= current_time + MINIMUM_DELEGATION_DURATION_NS || 
       req.expiry > current_time + MAX_DELEGATION_DURATION_NS {
        return Err(DelegationError::InvalidExpiry { 
            provided: req.expiry,
            current: current_time,
            max: current_time + MAX_DELEGATION_DURATION_NS,
        });
    }

    let delegation_id = generate_secure_delegation_id(caller, req.delegatee, req.expiry).await?;

    let delegation_data = DelegationData {
        expiry: req.expiry,
        delegation_id: delegation_id.clone(),
        created_at: current_time,
        last_used: current_time,
        use_count: 0,
    };

    DELEGATIONS.with(|d| {
        d.borrow_mut().insert(
            StorablePrincipal::from(req.delegatee),
            delegation_data
        );
    });

    Ok(DelegationResponse::Ok {
        delegation_id,
        expiry: req.expiry,
    })
}

// Generate a secure delegation ID using multiple sources of entropy
async fn generate_secure_delegation_id(
    delegator: Principal,
    delegatee: Principal,
    expiry: u64,
) -> Result<Vec<u8>, DelegationError> {
    let mut data = Vec::new();
    data.extend_from_slice(delegator.as_slice());
    data.extend_from_slice(delegatee.as_slice());
    data.extend_from_slice(&expiry.to_be_bytes());
    data.extend_from_slice(&api::time().to_be_bytes());

    let seed: Vec<u8> = match ic_cdk::api::management_canister::main::raw_rand()
        .await
        .map_err(|e| DelegationError::SystemError(format!("Failed to get randomness: {:?}", e)))? {
            (bytes,) => bytes
    };

    let mut final_data = Vec::new();
    final_data.extend_from_slice(&seed);
    final_data.extend_from_slice(&data);

    let (more_entropy,) = ic_cdk::api::management_canister::main::raw_rand()
        .await
        .map_err(|e| DelegationError::SystemError(format!("Failed to get final entropy: {:?}", e)))?;

    final_data.extend_from_slice(&more_entropy);

    let mut result = Vec::with_capacity(32);
    for chunk in final_data.chunks(32) {
        let mut hash = 0u64;
        for (i, &byte) in chunk.iter().enumerate() {
            hash = hash.wrapping_add((byte as u64).wrapping_mul(i as u64 + 1));
        }
        result.extend_from_slice(&hash.to_be_bytes());
    }
    result.truncate(32);
    
    Ok(result)
}


// Clean up expired delegations
#[ic_cdk::update]
pub fn cleanup_expired_delegations() -> u64 {
    let current_time = api::time();
    let mut cleaned = 0;
    
    DELEGATIONS.with(|d| {
        let mut delegations = d.borrow_mut();
        let expired: Vec<_> = delegations
            .iter()
            .filter(|(_, data)| data.expiry <= current_time)
            .map(|(key, _)| key.clone())
            .collect();
            
        for key in expired {
            delegations.remove(&key);
            cleaned += 1;
        }
    });
    
    cleaned
}

// Check rate limiting for a principal
fn check_rate_limit(principal: &Principal) -> Result<(), DelegationError> {
    let current_time = api::time();
    
    FAILED_ATTEMPTS.with(|attempts| {
        let mut attempts = attempts.borrow_mut();
        if let Some((count, last_attempt)) = attempts.get(&StorablePrincipal::from(*principal)) {
            if current_time - last_attempt < RATE_LIMIT_WINDOW_NS {
                if count >= MAX_FAILED_ATTEMPTS {
                    return Err(DelegationError::RateLimitExceeded {
                        next_allowed: last_attempt + RATE_LIMIT_WINDOW_NS,
                    });
                }
            } else {
                attempts.insert(
                    StorablePrincipal::from(*principal),
                    (1, current_time)
                );
            }
        }
        Ok(())
    })
}

// ICRC-28 implementation
#[ic_cdk::query]
pub fn icrc28_trusted_origins() -> TrustedOriginsResponse {
    TrustedOriginsResponse {
        trusted_origins: get_trusted_origins(),
    }
}

// ICRC-10 implementation
#[ic_cdk::query]
pub fn icrc10_supported_standards() -> Vec<SupportedStandard> {
    vec![
        SupportedStandard {
            name: "ICRC-28".to_string(),
            url: "https://github.com/dfinity/ICRC/tree/main/ICRCs/ICRC-28/ICRC-28.md".to_string(),
        },
        SupportedStandard {
            name: "ICRC-10".to_string(),
            url: "https://github.com/dfinity/ICRC/blob/main/ICRCs/ICRC-10/ICRC-10.md".to_string(),
        },
        SupportedStandard {
            name: "ICRC-34".to_string(),
            url: "https://github.com/dfinity/ICRC/tree/main/ICRCs/ICRC-34/ICRC-34.md".to_string(),
        },
    ]
}
