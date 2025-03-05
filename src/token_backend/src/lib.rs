// src/token_backend/src/lib.rs
#![recursion_limit = "256"]

use candid::{CandidType, Nat, Principal};
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use icrc_ledger_types::icrc1::account::Account;
use std::collections::BTreeMap;
use ic_stable_structures::{
    memory_manager::{MemoryManager, MemoryId, VirtualMemory},
    DefaultMemoryImpl, StableBTreeMap, StableCell, StableLog,
    Storable, storable::Bound
};
use std::borrow::Cow;

mod block_templates;
mod mining;
mod types;
mod standards;
mod security;
mod http;

use block_templates::{BlockTemplate, Hash, Event, EventType};
use types::*;

// Store token state
thread_local! {
    static LEDGER_ID: RefCell<Option<Principal>> = RefCell::new(None);
    static TARGET_NUMBER: RefCell<Option<u64>> = RefCell::new(None);
    static TOKEN_INFO: RefCell<Option<TokenInfo>> = RefCell::new(None);
    static CREATOR: RefCell<Option<Principal>> = RefCell::new(None);
    static MINERS: RefCell<BTreeMap<Principal, MinerInfo>> = RefCell::new(BTreeMap::new());
    static CIRCULATING_SUPPLY: RefCell<u64> = RefCell::new(0);
}

// Memory manager for stable storage
thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
        MemoryManager::init(DefaultMemoryImpl::default())
    );

    static TOKEN_INFO_CELL: RefCell<StableCell<Option<TokenInfo>, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0))),
            None,
        ).expect("Failed to init TOKEN_INFO_CELL")
    );

    static CREATOR_CELL: RefCell<StableCell<Option<StorablePrincipal>, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(1))),
            None,
        ).expect("Failed to init CREATOR_CELL")
    );

    static LEDGER_ID_CELL: RefCell<StableCell<Option<StorablePrincipal>, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(2))),
            None,
        ).expect("Failed to init LEDGER_ID_CELL")
    );

    static CIRCULATING_SUPPLY_CELL: RefCell<StableCell<u64, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(3))),
            0,
        ).expect("Failed to init CIRCULATING_SUPPLY_CELL")
    );

    static MINERS_MAP: RefCell<StableBTreeMap<StorablePrincipal, MinerInfo, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(4)))
        )
    );

    static EVENT_LOG: RefCell<StableLog<Event, Memory, Memory>> = RefCell::new(
        StableLog::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(5))),
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(6))),
        ).expect("Failed to init EVENT_LOG")
    );

    static BLOCK_HEIGHT: RefCell<StableCell<u64, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(7))),
            0,
        ).expect("Failed to init BLOCK_HEIGHT")
    );

    static HEARTBEAT_COUNTER: RefCell<u64> = RefCell::new(0);
}

// Define Memory type
type Memory = VirtualMemory<DefaultMemoryImpl>;

// Define StorablePrincipal wrapper
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
struct StorablePrincipal(Principal);

impl Storable for StorablePrincipal {
    fn to_bytes(&self) -> Cow<[u8]> {
        let principal_bytes = self.0.as_slice();
        let mut bytes = Vec::with_capacity(principal_bytes.len());
        bytes.extend_from_slice(principal_bytes);
        // Pad with zeros to fixed size
        bytes.resize(32, 0);
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        // Find last non-zero byte
        let last_non_zero = bytes.iter()
            .rposition(|&b| b != 0)
            .map(|p| p + 1)
            .unwrap_or(0);
        
        // Take slice up to last non-zero byte
        Self(Principal::from_slice(&bytes[..last_non_zero]))
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 32,
        is_fixed_size: true,
    };
}

// Keep only one direction of automatic conversion
impl From<Principal> for StorablePrincipal {
    fn from(p: Principal) -> Self {
        Self(p)
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
struct TokenInfo {
    name: String,
    ticker: String,
    total_supply: u64,
    ledger_id: Option<Principal>,
    logo: Option<String>,
    decimals: u8,
    transfer_fee: u64,
    archive_options: Option<ArchiveOptions>,
    social_links: Option<Vec<SocialLink>>,
}

#[derive(CandidType, Serialize, Deserialize)]
struct TokenInitArgs {
    name: String,
    ticker: String,
    total_supply: u64,
    logo: Option<String>,
    decimals: Option<u8>,
    transfer_fee: Option<u64>,
    archive_options: Option<ArchiveOptions>,
    initial_block_reward: u64,
    block_time_target_seconds: u64,
    halving_interval: u64,
    social_links: Option<Vec<SocialLink>>,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
struct TokenMetrics {
    total_supply: u64,
    circulating_supply: u64,
}

#[derive(CandidType, Deserialize)]
enum MetricsResult {
    Ok(TokenMetrics),
    Err(String),
}

// Authentication helper functions
fn is_authenticated() -> bool {
    let caller = ic_cdk::caller();
    caller != Principal::anonymous()
}

fn require_auth() -> Result<Principal, String> {
    let _caller = ic_cdk::caller();
    if _caller == Principal::anonymous() {
        Err("Authentication required".to_string())
    } else {
        Ok(_caller)
    }
}

// Get authentication status
#[ic_cdk::query]
fn get_auth_status() -> bool {
    is_authenticated()
}

// Implement Storable for TokenInfo
impl Storable for TokenInfo {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(candid::encode_one(self).expect("Failed to encode TokenInfo"))
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        candid::decode_one(&bytes).expect("Failed to decode TokenInfo")
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 1024,
        is_fixed_size: false,
    };
}

// Add heartbeat system method
#[ic_cdk::heartbeat]
fn heartbeat() {
    let counter = HEARTBEAT_COUNTER.with(|c| {
        let mut counter = c.borrow_mut();
        *counter += 1;
        *counter
    });
    
    // Clean up rate limits every 60 heartbeats (less frequently)
    if counter % 60 == 0 {
        security::cleanup_rate_limits();
        
        // Update block template every 60 heartbeats
        if mining::update_block_template() {
            ic_cdk::println!("Block template updated by heartbeat");
        }
    }
}

// Update init function to use stable cells
#[ic_cdk_macros::init]
fn init(args: TokenInitArgs) {
    // Initialize memory manager and stable structures
    const TOTAL_MEMORY_REGIONS: u8 = 25; // Updated to accommodate all regions (0-24)

    MEMORY_MANAGER.with(|m| {
        let mm = m.borrow_mut();
        for i in 0..TOTAL_MEMORY_REGIONS {
            mm.get(MemoryId::new(i));
        }
    });

    // Initialize standards module
    standards::init();

    // Initialize HTTP asset certification
    http::init_asset_certification();

    // Set creator to caller
    let caller = ic_cdk::caller();
    CREATOR_CELL.with(|c| {
        c.borrow_mut().set(Some(StorablePrincipal(caller))).expect("Failed to set creator");
    });
    ic_cdk::println!("Setting creator to: {}", caller.to_text());

    // Initialize token state
    TOKEN_INFO_CELL.with(|info| {
        info.borrow_mut().set(Some(TokenInfo {
            name: args.name,
            ticker: args.ticker,
            total_supply: args.total_supply,
            ledger_id: None,
            logo: args.logo,
            decimals: args.decimals.unwrap_or(8),
            transfer_fee: args.transfer_fee.unwrap_or(1),
            archive_options: args.archive_options,
            social_links: args.social_links,
        })).expect("Failed to set token info");
    });

    // Initialize circulating supply to 0
    CIRCULATING_SUPPLY_CELL.with(|c| {
        c.borrow_mut().set(0).expect("Failed to init circulating supply");
    });

    // Initialize ledger ID to None
    LEDGER_ID_CELL.with(|l| {
        l.borrow_mut().set(None).expect("Failed to init ledger ID");
    });

    // Initialize mining parameters with minimum difficulty check
    mining::init_mining_params(
        args.initial_block_reward,
        args.block_time_target_seconds,
        args.halving_interval
    );

    ic_cdk::println!("Token backend initialized with stable memory structures and security measures");
}

// Update start_token with proper initialization
#[ic_cdk::update]
async fn start_token() -> Result<Principal, String> {
    // First check authentication
    let _caller = require_auth()?;
    
    // Then check if caller is creator
    let is_creator = CREATOR_CELL.with(|c| {
        c.borrow().get().as_ref().map(|p| p.0) == Some(_caller)
    });
    if !is_creator {
        return Err("Only creator can start the token".to_string());
    }

    // Check if token is already started
    if LEDGER_ID_CELL.with(|id| id.borrow().get().is_some()) {
        return Err("Token already started".to_string());
    }

    // Get token info with proper reference handling
    let token_info = TOKEN_INFO_CELL.with(|info| {
        info.borrow()
            .get()
            .as_ref()
            .cloned()
            .ok_or_else(|| "Token info not initialized".to_string())
    })?;

    // Create ICRC ledger canister
    let create_result = ic_cdk::api::management_canister::main::create_canister(
        ic_cdk::api::management_canister::main::CreateCanisterArgument { settings: None },
        1_000_000_000_000u128, // 1 Trillion cycles
    ).await.map_err(|e| format!("Failed to create ledger canister: {:?}", e))?;
    
    let ledger_id = Principal::from(create_result.0.canister_id);
    
    // Initialize token parameters
    let init_args = InitArgs {
        minting_account: Account {
            owner: _caller,
            subaccount: None,
        },
        fee_collector_account: None,
        transfer_fee: Nat::from(token_info.transfer_fee),
        decimals: Some(token_info.decimals),
        max_memo_length: Some(32),
        token_name: token_info.name.clone(),
        token_symbol: token_info.ticker.clone(),
        metadata: build_metadata(&token_info),
        initial_balances: vec![
            (
                Account {
                    owner: ic_cdk::id(),
                    subaccount: None,
                },
                Nat::from(token_info.total_supply),
            ),
        ],
        feature_flags: Some(FeatureFlags { icrc2: true }),
        maximum_number_of_accounts: Some(100_000),
        accounts_overflow_trim_quantity: Some(1_000),
        archive_options: token_info.archive_options.unwrap_or_else(|| default_archive_options(_caller)),
    };

    let ledger_arg = LedgerArg::Init(init_args);
    let encoded_args = candid::encode_one(ledger_arg).expect("Failed to encode init args");

    // Install ICRC ledger code
    let install_args = ic_cdk::api::management_canister::main::InstallCodeArgument {
        mode: ic_cdk::api::management_canister::main::CanisterInstallMode::Install,
        canister_id: ledger_id,
        wasm_module: icrc_ledger_wasm(),
        arg: encoded_args,
    };

    ic_cdk::api::management_canister::main::install_code(install_args)
        .await
        .map_err(|e| format!("Failed to install ledger code: {:?}", e))?;
    
    // Update token info with ledger ID
    TOKEN_INFO_CELL.with(|info| {
        let mut current_info = info.borrow()
            .get()
            .as_ref()
            .cloned()
            .ok_or_else(|| "Token info not found".to_string())
            .unwrap();
        current_info.ledger_id = Some(ledger_id);
        info.borrow_mut()
            .set(Some(current_info))
            .expect("Failed to update token info");
    });

    // Store ledger ID
    LEDGER_ID_CELL.with(|id| {
        id.borrow_mut()
            .set(Some(StorablePrincipal(ledger_id)))
            .expect("Failed to set ledger ID");
    });
    
    Ok(ledger_id)
}

// Helper function to read ICRC ledger WASM
fn icrc_ledger_wasm() -> Vec<u8> {
    include_bytes!("../../kong_svelte/static/wasms/ledger/ledger.wasm").to_vec()
}

// Update get_info to use stable cell
#[ic_cdk::query]
fn get_info() -> Result<TokenInfo, String> {
    TOKEN_INFO_CELL.with(|info| {
        info.borrow().get().as_ref().cloned().ok_or_else(|| "Token not initialized".to_string())
    })
}

// Get caller's principal
#[ic_cdk::query]
fn whoami() -> Principal {
    ic_cdk::caller()
}

// Update get_metrics to handle references properly
#[ic_cdk::query]
fn get_metrics() -> MetricsResult {
    let token_info = match TOKEN_INFO_CELL.with(|info| {
        info.borrow()
            .get()
            .as_ref()
            .cloned()
    }) {
        Some(info) => info,
        _ => return MetricsResult::Err("Token not initialized".to_string()),
    };

    let circulating_supply = CIRCULATING_SUPPLY_CELL.with(|supply| *supply.borrow().get());

    MetricsResult::Ok(TokenMetrics {
        total_supply: token_info.total_supply,
        circulating_supply,
    })
}

// Update circulating supply helper
fn update_circulating_supply(amount: u64) {
    CIRCULATING_SUPPLY_CELL.with(|supply| {
        let current = *supply.borrow().get();
        supply.borrow_mut().set(current + amount).expect("Failed to update circulating supply");
    });
}

// Re-export mining functions
pub use mining::{
    generate_new_block,
    create_genesis_block,
    submit_solution,
    get_current_block,
    get_mining_difficulty,
    get_mining_info,
    EventBatch,
    get_event_batches,
    get_recent_events_from_batches,
    get_average_block_time,
    BlockTimeResult,
    restore_mining_params,
};

// Re-export standards types for Candid
pub use standards::{
    ConsentMessageRequest,
    ConsentMessageResponse,
    DelegationRequest,
    DelegationResponse,
    DelegationError,
    SupportedStandard,
    TrustedOriginsResponse,
};

// Re-export HTTP types and functions
pub use http::{
    HttpRequest,
    HttpResponse,
    http_request,
};

fn build_metadata(token_info: &TokenInfo) -> Vec<(String, MetadataValue)> {
    let mut metadata = vec![
        ("icrc1:name".to_string(), MetadataValue::Text(token_info.name.clone())),
        ("icrc1:symbol".to_string(), MetadataValue::Text(token_info.ticker.clone())),
        ("icrc1:decimals".to_string(), MetadataValue::Nat(Nat::from(token_info.decimals))),
        ("icrc1:fee".to_string(), MetadataValue::Nat(Nat::from(token_info.transfer_fee))),
    ];
    
    if let Some(ref logo) = token_info.logo {
        metadata.push(("icrc1:logo".to_string(), MetadataValue::Text(logo.clone())));
    }
    
    metadata
}

fn default_archive_options(controller: Principal) -> ArchiveOptions {
    ArchiveOptions {
        num_blocks_to_archive: 2000,
        max_transactions_per_response: Some(1000),
        trigger_threshold: 1000,
        max_message_size_bytes: Some(3 * 1024 * 1024), // 3MB
        cycles_for_archive_creation: Some(10_000_000_000_000), // 10T cycles
        node_max_memory_size_bytes: Some(4 * 1024 * 1024 * 1024), // 4GB
        controller_id: controller,
        more_controller_ids: None,
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
struct MinerStats {
    blocks_mined: u64,
    total_rewards: u64,
    first_block_timestamp: Option<u64>,
    last_block_timestamp: Option<u64>,
    total_hashes_processed: u64,
    current_hashrate: f64,
    average_hashrate: f64,
    best_hashrate: f64,
    last_hashrate_update: Option<u64>,
    hashrate_samples: Vec<(u64, f64)>,
}

impl Default for MinerStats {
    fn default() -> Self {
        Self {
            blocks_mined: 0,
            total_rewards: 0,
            first_block_timestamp: None,
            last_block_timestamp: None,
            total_hashes_processed: 0,
            current_hashrate: 0.0,
            average_hashrate: 0.0,
            best_hashrate: 0.0,
            last_hashrate_update: None,
            hashrate_samples: Vec::new(),
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
enum MinerStatus {
    Active,
    Inactive,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
struct MinerInfo {
    principal: Principal,
    status: MinerStatus,
    stats: MinerStats,
    registration_time: u64,
    last_status_change: u64,
}

// Implement Storable for MinerInfo
impl Storable for MinerInfo {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(candid::encode_one(self).expect("Failed to encode MinerInfo"))
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        candid::decode_one(&bytes).expect("Failed to decode MinerInfo")
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 1024,
        is_fixed_size: false,
    };
}

// Helper function to get block height with proper dereferencing
fn get_block_height() -> u64 {
    BLOCK_HEIGHT.with(|h| *h.borrow().get())
}

// Helper function to increment block height
fn increment_block_height() -> u64 {
    BLOCK_HEIGHT.with(|h| {
        let current = *h.borrow().get();
        h.borrow_mut().set(current + 1).expect("Failed to increment block height");
        current + 1
    })
}

// Helper function to log events with proper block height handling
fn log_event(mut event: Event) {
    let current_height = get_block_height();
    event.block_height = current_height;
    
    EVENT_LOG.with(|log| {
        let log = log.borrow_mut();
        // Pre-allocate space for the event
        log.append(&event).expect("Failed to append event");
    });
}

// Update miner registration with proper block height handling
#[ic_cdk::update]
async fn register_miner() -> Result<(), String> {
    let caller = require_auth()?;
    
    // Verify caller is a canister
    if !caller.to_text().ends_with("-cai") {
        return Err("Only canister principals can register as miners".to_string());
    }

    let now = ic_cdk::api::time();
    let current_height = get_block_height();
    
    MINERS_MAP.with(|miners| {
        let mut miners = miners.borrow_mut();
        
        // If miner already exists, just update status
        if let Some(mut info) = miners.get(&StorablePrincipal(caller)) {
            info.status = MinerStatus::Active;
            info.last_status_change = now;
            miners.insert(StorablePrincipal(caller), info);
            return Ok(());
        }
        
        // Create new miner info
        let miner_info = MinerInfo {
            principal: caller,
            status: MinerStatus::Active,
            stats: MinerStats {
                blocks_mined: 0,
                total_rewards: 0,
                first_block_timestamp: None,
                last_block_timestamp: None,
                total_hashes_processed: 0,
                current_hashrate: 0.0,
                average_hashrate: 0.0,
                best_hashrate: 0.0,
                last_hashrate_update: None,
                hashrate_samples: Vec::new(),
            },
            registration_time: now,
            last_status_change: now,
        };
        
        miners.insert(StorablePrincipal(caller), miner_info.clone());
        
        // Log registration event
        log_event(Event {
            event_type: EventType::SystemAnnouncement {
                message: format!("New miner registered: {}", caller),
                severity: "info".to_string(),
            },
            timestamp: now,
            block_height: current_height,
        });

        Ok(())
    })
}

#[ic_cdk::update]
fn deregister_miner() -> Result<(), String> {
    let caller = require_auth()?;
    
    MINERS_MAP.with(|miners| {
        let mut miners = miners.borrow_mut();
        if let Some(mut info) = miners.get(&StorablePrincipal(caller)) {
            info.status = MinerStatus::Inactive;
            info.last_status_change = ic_cdk::api::time();
            miners.insert(StorablePrincipal(caller), info);
        }
    });

    Ok(())
}

#[ic_cdk::query]
fn get_miners() -> Vec<MinerInfo> {
    MINERS_MAP.with(|miners| {
        let miners = miners.borrow();
        let mut result = Vec::with_capacity(miners.len().try_into().unwrap_or(0));
        for (_, info) in miners.iter() {
            result.push(info.clone());
        }
        result
    })
}

#[ic_cdk::query]
fn get_active_miners() -> Vec<Principal> {
    MINERS_MAP.with(|miners| {
        let miners = miners.borrow();
        let mut result = Vec::with_capacity(miners.len().try_into().unwrap_or(0));
        for (principal, info) in miners.iter() {
            if matches!(info.status, MinerStatus::Active) {
                result.push(principal.0);
            }
        }
        result.shrink_to_fit();
        result
    })
}

// Helper function to update miner stats
fn update_miner_stats(miner: Principal, reward: u64) {
    let now = ic_cdk::api::time();
    
    MINERS_MAP.with(|miners| {
        let mut miners = miners.borrow_mut();
        if let Some(mut info) = miners.get(&StorablePrincipal(miner)) {
            let blocks_mined = info.stats.blocks_mined + 1;  // Cache the value
            info.stats.blocks_mined += 1;
            info.stats.total_rewards += reward;
            info.stats.last_block_timestamp = Some(now);
            if info.stats.first_block_timestamp.is_none() {
                info.stats.first_block_timestamp = Some(now);
            }
            
            // Pre-allocate milestone event if needed
            let milestone_event = {
                let milestones = [
                    (10, "IC Cadet"),
                    (100, "Canister Captain"),
                    (1000, "Cycles Sovereign"),
                    (10000, "Internet Computer Legend")
                ];
                
                milestones.iter()
                    .find(|&&(threshold, _)| blocks_mined == threshold)
                    .map(|&(_, title)| Event {
                        event_type: EventType::MiningMilestone {
                            miner,
                            achievement: title.to_string(),
                            blocks_mined,
                        },
                        timestamp: now,
                        block_height: BLOCK_HEIGHT.with(|h| *h.borrow().get()),
                    })
            };
            
            miners.insert(StorablePrincipal(miner), info);

            // Log milestone event if applicable
            if let Some(event) = milestone_event {
                log_event(event);
            }
        }
    });
}

#[ic_cdk::query]
fn get_miner_stats(miner: Principal) -> Option<MinerInfo> {
    MINERS_MAP.with(|miners| {
        miners.borrow().get(&StorablePrincipal(miner))
    })
}

#[ic_cdk::query]
fn get_miner_leaderboard(limit: Option<u32>) -> Vec<MinerInfo> {
    let limit = limit.unwrap_or(10) as usize;
    
    MINERS_MAP.with(|miners| {
        let miners = miners.borrow();
        let mut result: Vec<MinerInfo> = Vec::with_capacity(miners.len().try_into().unwrap_or(0));
        for (_, info) in miners.iter() {
            result.push(info.clone());
        }
        result.sort_by(|a, b| b.stats.blocks_mined.cmp(&a.stats.blocks_mined));
        result.truncate(limit);
        result
    })
}

// Add function to get recent events
#[ic_cdk::query]
fn get_recent_events(limit: Option<u32>) -> Vec<Event> {
    let limit = limit.unwrap_or(50) as u64;
    
    EVENT_LOG.with(|log| {
        let log = log.borrow();
        let len = log.len();  // This is u64
        let start = if len > limit { 
            len - limit
        } else { 
            0 
        };
        
        // Pre-allocate exact size needed
        let capacity = (len - start).try_into().unwrap_or(0);
        let mut events = Vec::with_capacity(capacity);
        
        // Use range with u64
        for i in start..len {
            if let Some(event) = log.get(i) {
                events.push(event);
            }
        }
        events
    })
}

// Social links management functions
#[ic_cdk::query]
fn get_social_links() -> Result<Vec<SocialLink>, String> {
    TOKEN_INFO_CELL.with(|info| {
        info.borrow()
            .get()
            .as_ref()
            .ok_or_else(|| "Token not initialized".to_string())
            .map(|token_info| token_info.social_links.clone().unwrap_or_default())
    })
}

#[ic_cdk::update]
fn add_social_link(platform: String, url: String) -> Result<(), String> {
    // First check authentication
    let caller = require_auth()?;
    
    // Then check if caller is creator
    let is_creator = CREATOR_CELL.with(|c| {
        c.borrow().get().as_ref().map(|p| p.0) == Some(caller)
    });
    if !is_creator {
        return Err("Only creator can modify social links".to_string());
    }

    TOKEN_INFO_CELL.with(|info| {
        let mut token_info = info.borrow()
            .get()
            .as_ref()
            .cloned()
            .ok_or_else(|| "Token not initialized".to_string())?;
        
        let mut links = token_info.social_links.unwrap_or_default();
        links.push(SocialLink { platform, url });
        token_info.social_links = Some(links);
        
        info.borrow_mut()
            .set(Some(token_info))
            .map_err(|e| format!("Failed to update token info: {:?}", e))?;
        
        Ok(())
    })
}

#[ic_cdk::update]
fn update_social_link(index: usize, platform: String, url: String) -> Result<(), String> {
    // First check authentication
    let caller = require_auth()?;
    
    // Then check if caller is creator
    let is_creator = CREATOR_CELL.with(|c| {
        c.borrow().get().as_ref().map(|p| p.0) == Some(caller)
    });
    if !is_creator {
        return Err("Only creator can modify social links".to_string());
    }

    TOKEN_INFO_CELL.with(|info| {
        let mut token_info = info.borrow()
            .get()
            .as_ref()
            .cloned()
            .ok_or_else(|| "Token not initialized".to_string())?;
        
        let mut links = token_info.social_links.unwrap_or_default();
        if index >= links.len() {
            return Err(format!("Social link index {} out of bounds", index));
        }
        
        links[index] = SocialLink { platform, url };
        token_info.social_links = Some(links);
        
        info.borrow_mut()
            .set(Some(token_info))
            .map_err(|e| format!("Failed to update token info: {:?}", e))?;
        
        Ok(())
    })
}

#[ic_cdk::update]
fn remove_social_link(index: usize) -> Result<(), String> {
    // First check authentication
    let caller = require_auth()?;
    
    // Then check if caller is creator
    let is_creator = CREATOR_CELL.with(|c| {
        c.borrow().get().as_ref().map(|p| p.0) == Some(caller)
    });
    if !is_creator {
        return Err("Only creator can modify social links".to_string());
    }

    TOKEN_INFO_CELL.with(|info| {
        let mut token_info = info.borrow()
            .get()
            .as_ref()
            .cloned()
            .ok_or_else(|| "Token not initialized".to_string())?;
        
        let mut links = token_info.social_links.unwrap_or_default();
        if index >= links.len() {
            return Err(format!("Social link index {} out of bounds", index));
        }
        
        links.remove(index);
        token_info.social_links = Some(links);
        
        info.borrow_mut()
            .set(Some(token_info))
            .map_err(|e| format!("Failed to update token info: {:?}", e))?;
        
        Ok(())
    })
}

/// Returns the version of the token canister implementation
#[ic_cdk::query]
fn icrc1_version() -> String {
    "v1.0.0".to_string()
}

// Candid interface export
ic_cdk::export_candid!();

#[ic_cdk_macros::pre_upgrade]
fn pre_upgrade() {
    // The pre_upgrade hook ensures that stable memory is properly preserved
    // No additional action needed as we're using StableCell for storage
    ic_cdk::println!("Pre-upgrade: Preparing for canister upgrade");
}

#[ic_cdk_macros::post_upgrade]
fn post_upgrade() {
    // Re-initialize asset certification after upgrade
    http::init_asset_certification();
    
    // Initialize memory manager to ensure all regions are allocated
    MEMORY_MANAGER.with(|m| {
        let mm = m.borrow_mut();
        const TOTAL_MEMORY_REGIONS: u8 = 25; // Updated to accommodate all regions (0-24)
        for i in 0..TOTAL_MEMORY_REGIONS {
            mm.get(MemoryId::new(i));
        }
    });
    
    // Initialize mining memory and restore parameters if needed
    mining::initialize_memory();
    
    // Log the current mining parameters after upgrade
    let difficulty = mining::get_mining_difficulty();
    let block_time = mining::get_block_time_target();
    let mining_info = mining::get_mining_info();
    
    ic_cdk::println!("Post-upgrade: Mining parameters - difficulty: {}, block_time_target: {}", 
        difficulty, block_time);
    ic_cdk::println!("Post-upgrade: Mining info: {:?}", mining_info);
    ic_cdk::println!("Post-upgrade: Asset certification and mining memory re-initialized");
}
