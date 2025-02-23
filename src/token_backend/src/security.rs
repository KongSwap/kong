use candid::Principal;
use ic_cdk::api;
use std::cell::RefCell;
use ic_stable_structures::{
    memory_manager::{MemoryId, VirtualMemory},
    DefaultMemoryImpl, StableBTreeMap, Storable, storable::Bound
};
use std::borrow::Cow;
use std::cmp::Ordering;

// Constants for rate limiting
const MAX_PAYLOAD_SIZE: usize = 1_000_000; // 1MB max payload
const RATE_LIMIT_WINDOW_NS: u64 = 60_000_000_000; // 1 minute
const MAX_CALLS_PER_WINDOW: u32 = 100; // 100 calls per minute per principal
const STRICT_RATE_LIMIT_METHODS: [&str; 4] = [
    "register_miner",
    "submit_solution",
    "start_token",
    "icrc34_delegate"
];

// Include generated query methods
pub const QUERY_METHODS: &[&str] = &[
    "get_active_miners", "get_auth_status", "get_current_block", 
    "get_event_batches", "get_info", "get_metrics", 
    "get_miner_leaderboard", "get_miner_stats", "get_miners", 
    "get_mining_difficulty", "get_mining_info", "get_recent_events", 
    "get_target", "get_total_cycles_earned", "http_request", "whoami"
];

thread_local! {
    // Track call counts per principal
    static CALL_TRACKER: RefCell<StableBTreeMap<StorablePrincipal, (u32, u64), VirtualMemory<DefaultMemoryImpl>>> = RefCell::new(
        StableBTreeMap::init(
            super::MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(24)))
        )
    );
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct StorablePrincipal(Principal);

impl Ord for StorablePrincipal {
    fn cmp(&self, other: &Self) -> Ordering {
        self.0.as_slice().cmp(other.0.as_slice())
    }
}

impl PartialOrd for StorablePrincipal {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

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

// Ingress message inspection
#[ic_cdk::inspect_message]
fn inspect_message() {
    let method_name = ic_cdk::api::call::method_name();
    let caller = ic_cdk::caller();
    
    // 1. Check if this is a query-only method being called as update
    if QUERY_METHODS.contains(&method_name.as_str()) {
        ic_cdk::println!("Rejecting update call to query method {} from {}", 
            method_name, 
            caller.to_text()
        );
        ic_cdk::trap(&format!("{} can only be called as a query (update rejected)", method_name));
    }

    // 2. Payload size check
    let arg_size = ic_cdk::api::call::arg_data_raw().len();
    if arg_size > MAX_PAYLOAD_SIZE {
        ic_cdk::println!("Rejected oversized payload from {}: {} bytes", 
            caller.to_text(), 
            arg_size
        );
        ic_cdk::trap("Payload size exceeds limit");
    }

    // 3. Rate limiting for update calls
    if !check_rate_limit(&caller, &method_name) {
        ic_cdk::println!("Rate limit exceeded for {} by {}", 
            method_name,
            caller.to_text()
        );
        ic_cdk::trap("Rate limit exceeded");
    }

    // 4. Method-specific checks
    match method_name.as_str() {
        // Prevent anonymous calls to sensitive methods
        "start_token" | "register_miner" | "submit_solution" | "icrc34_delegate" => {
            if caller == Principal::anonymous() {
                ic_cdk::println!("Rejected anonymous call to {}", method_name);
                ic_cdk::trap("Anonymous calls not allowed for this method");
            }
        },
        _ => {}
    }

    // Accept all other messages
    ic_cdk::api::call::accept_message();
}

// Rate limiting implementation
fn check_rate_limit(principal: &Principal, method: &str) -> bool {
    let current_time = api::time();
    let is_strict_method = STRICT_RATE_LIMIT_METHODS.contains(&method);
    
    CALL_TRACKER.with(|tracker| {
        let mut tracker = tracker.borrow_mut();
        let storable_principal = StorablePrincipal(principal.clone());
        
        match tracker.get(&storable_principal) {
            Some((count, window_start)) => {
                if current_time - window_start < RATE_LIMIT_WINDOW_NS {
                    // Still within window
                    let max_allowed = if is_strict_method { 
                        MAX_CALLS_PER_WINDOW / 10  // Stricter limit for sensitive methods
                    } else {
                        MAX_CALLS_PER_WINDOW
                    };
                    
                    if count >= max_allowed {
                        return false;
                    }
                    
                    tracker.insert(
                        storable_principal,
                        (count + 1, window_start)
                    );
                } else {
                    // New window
                    tracker.insert(
                        storable_principal,
                        (1, current_time)
                    );
                }
            },
            None => {
                // First call from this principal
                tracker.insert(
                    storable_principal,
                    (1, current_time)
                );
            }
        }
        true
    })
}

// Clean up old rate limit entries periodically
pub fn cleanup_rate_limits() {
    let current_time = api::time();
    
    CALL_TRACKER.with(|tracker| {
        let mut tracker = tracker.borrow_mut();
        let expired: Vec<_> = tracker
            .iter()
            .filter(|(_, (_, window_start))| 
                current_time - window_start > RATE_LIMIT_WINDOW_NS * 2
            )
            .map(|(key, _)| key.clone())
            .collect();
            
        for key in expired {
            tracker.remove(&key);
        }
    });
}
