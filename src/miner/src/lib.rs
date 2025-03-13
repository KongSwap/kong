// src/miner/src/lib.rs

use candid::{CandidType, Principal, Nat};
use ic_cdk::api::call::call;
use ic_cdk::api::call::call_with_payment128;
use ic_cdk::api::management_canister::http_request::{http_request, CanisterHttpRequestArgument, HttpHeader, HttpMethod};
use ic_cdk::api::management_canister::main::raw_rand;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::cell::RefCell;
use std::collections::VecDeque;
use hex;

mod block_miner;
use block_miner::{BlockMiner, MiningStats, Hash, MiningResult};

const ICRC_VERSION: u8 = 1;

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

#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
pub struct Event {
    event_type: EventType,
    timestamp: u64,
    block_height: u64,
}

#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
enum EventType {
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
    VersionUpgrade {
        new_version: String,
        features: Vec<String>,
    },
    SystemAnnouncement {
        message: String,
        severity: String,
    },
    Achievement {
        miner: Principal,
        name: String,
        description: String,
    }
}

// Store miner state
thread_local! {
    static CURRENT_TOKEN: RefCell<Option<Principal>> = RefCell::new(None);
    static IS_MINING: RefCell<bool> = RefCell::new(false);
    static BLOCK_MINER: RefCell<Option<BlockMiner>> = RefCell::new(None);
    static CURRENT_BLOCK_HEIGHT: RefCell<u64> = RefCell::new(0);
    static START_NONCE: RefCell<u64> = RefCell::new(0);
    static LAST_BLOCK_FAILURE: RefCell<Option<u64>> = RefCell::new(None);
    static BLOCK_BACKOFF_DURATION: RefCell<u64> = RefCell::new(5_000_000_000); // Start with 5 seconds
    static HEARTBEAT_COUNTER: RefCell<u32> = RefCell::new(0); // Counter for heartbeats
    
    // API configuration for notifications
    static API_ENDPOINT: RefCell<Option<String>> = RefCell::new(None);
    static API_KEY: RefCell<Option<String>> = RefCell::new(None);
    static API_ENABLED: RefCell<bool> = RefCell::new(false);
    
    // Cycle tracking
    static CYCLE_MEASUREMENTS: RefCell<VecDeque<CycleMeasurement>> = RefCell::new(VecDeque::new());
    static LAST_CYCLE_CHECK: RefCell<u64> = RefCell::new(0); // Timestamp of last cycle check
    
    // Add a new thread_local to track when we can mine again after a failure
    static NEXT_MINING_ATTEMPT: RefCell<u64> = RefCell::new(0); // Timestamp when we can try mining again
}

// Cycle measurement struct
#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
struct CycleMeasurement {
    timestamp: u64,
    balance: u128,
}

// Cycle usage statistics
#[derive(Debug, Clone, CandidType, Serialize, Deserialize)]
struct CycleUsageStats {
    current_balance: u128,
    measurements: Vec<CycleMeasurement>,
    usage_last_15min: Option<u128>,
    usage_rate_per_hour: Option<f64>,
    estimated_remaining_time: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize)]
struct MinerInitArgs {}

#[ic_cdk::init]
fn init(_args: MinerInitArgs) {
    // Initialize block miner with default chunk size
    BLOCK_MINER.with(|miner| {
        *miner.borrow_mut() = Some(BlockMiner::new()); // Initialize with default settings
    });
    
    // Hardcode the API endpoint URL and enable notifications by default
    API_ENDPOINT.with(|e| *e.borrow_mut() = Some("https://api.floppa.ai/".to_string()));
    API_KEY.with(|k| *k.borrow_mut() = Some("default-key".to_string()));
    API_ENABLED.with(|e| *e.borrow_mut() = true);
    
}

// Helper function to check if caller is controller
fn caller_is_controller() -> Result<(), String> {
    let caller = ic_cdk::caller();
    if ic_cdk::api::is_controller(&caller) {
        Ok(())
    } else {
        Err("Caller is not the controller".to_string())
    }
}

#[ic_cdk::query]
fn get_canister_id() -> Principal {
    ic_cdk::api::id()
}

#[ic_cdk::update]
async fn connect_token(token_id: Principal) -> Result<(), String> {
    // Only controller can connect to tokens
    caller_is_controller()?;
    
    // Verify token exists and is valid by calling get_info
    // Note: token's get_info returns Result<TokenInfo, String>
    let result: Result<(Result<TokenInfo, String>,), _> = call(token_id, "get_info", ())
        .await
        .map_err(|(code, msg)| format!("Failed to call token: {} (code: {:?})", msg, code));
    
    // Handle nested Result types
    match result {
        Ok((inner_result,)) => {
            match inner_result {
                Ok(_token_info) => {
                    // Token info verified, now register with token backend
                    let register_result: Result<(Result<(), String>,), (ic_cdk::api::call::RejectionCode, String)> = 
                        call(token_id, "register_miner", ()).await;
                    
                    match register_result {
                        Ok((Ok(()),)) => {
                            // Successfully registered, now connect
                            CURRENT_TOKEN.with(|token| {
                                *token.borrow_mut() = Some(token_id);
                            });
                            
                            // Send notification for token connection
                            let connect_data = json!({
                                "token_id": token_id.to_text(),
                                "miner_id": ic_cdk::id().to_text(),
                                "chunk_size": BLOCK_MINER.with(|m| m.borrow().as_ref().map(|m| m.get_chunk_size()).unwrap_or(1000))
                            });
                            
                            notify_event("token_connected", connect_data);
                            Ok(())
                        },
                        Ok((Err(e),)) => Err(format!("Token rejected registration: {}", e)),
                        Err((code, msg)) => Err(format!("Failed to register with token: {} (code: {:?})", msg, code))
                    }
                },
                Err(e) => Err(format!("Token returned error: {}", e))
            }
        },
        Err(e) => Err(e)
    }
}

#[ic_cdk::update]
async fn disconnect_token() -> Result<(), String> {
    // Only controller can disconnect
    caller_is_controller()?;
    
    // Stop mining if active
    if IS_MINING.with(|m| *m.borrow()) {
        stop_mining()?;
    }
    
    // Get current token before disconnecting
    let token_id = CURRENT_TOKEN.with(|t| t.borrow().clone());
    
    // If we were connected to a token, deregister from it
    if let Some(token_id) = token_id {
        let deregister_result: Result<(Result<(), String>,), (ic_cdk::api::call::RejectionCode, String)> = 
            call(token_id, "deregister_miner", ()).await;
            
        match deregister_result {
            Ok((Ok(()),)) => (),
            Ok((Err(e),)) => return Err(format!("Token rejected deregistration: {}", e)),
            Err((code, msg)) => return Err(format!("Failed to deregister from token: {} (code: {:?})", msg, code))
        }
    }
    
    CURRENT_TOKEN.with(|token| {
        *token.borrow_mut() = None;
    });
    
    Ok(())
}

async fn generate_unique_nonce_start() -> Result<u64, String> {
    // Get random bytes for additional entropy
    let (random_bytes,) = raw_rand().await
        .map_err(|e| format!("Failed to get random bytes: {:?}", e))?;
    
    let miner_id = ic_cdk::id();
    let miner_id_bytes = miner_id.as_slice();
    
    // Combine miner ID and random bytes
    let mut unique_bytes = [0u8; 8];
    for (i, byte) in miner_id_bytes.iter().take(4).enumerate() {
        unique_bytes[i] = *byte;
    }
    for (i, byte) in random_bytes.iter().take(4).enumerate() {
        unique_bytes[i + 4] = *byte;
    }
    
    Ok(u64::from_le_bytes(unique_bytes))
}

// Constants for cycle payments
const SUBMISSION_CYCLES: u128 = 420_690; // Must match token_backend's requirement

#[ic_cdk::update]
async fn start_mining() -> Result<(), String> {
    // Only controller can start mining
    caller_is_controller()?;
    
    // Verify we have a token to mine
    let token_id = CURRENT_TOKEN.with(|t| {
        t.borrow().clone().ok_or("No token connected".to_string())
    })?;
    
    // Initialize the miner if it doesn't exist
    BLOCK_MINER.with(|m| {
        if m.borrow().is_none() {
            *m.borrow_mut() = Some(BlockMiner::new());
        }
    });
    
    // Set mining flag to true - this is a lightweight operation
    IS_MINING.with(|m| {
        *m.borrow_mut() = true;
    });
    
    // Reset heartbeat counter
    HEARTBEAT_COUNTER.with(|c| {
        *c.borrow_mut() = 0;
    });
    
    // Send notification for mining started (with minimal data)
    let mining_data = json!({
        "token_id": token_id.to_text(),
        "miner_id": ic_cdk::id().to_text(),
    });
    
    notify_event("mining_started", mining_data);
    
    // Return immediately - the heartbeat will handle the actual mining
    Ok(())
}

#[ic_cdk::update]
fn stop_mining() -> Result<(), String> {
    // Only controller can stop mining
    caller_is_controller()?;
    
    IS_MINING.with(|m| {
        *m.borrow_mut() = false;
    });
    
    Ok(())
}

#[ic_cdk::query]
fn get_mining_stats() -> Option<MiningStats> {
    BLOCK_MINER.with(|m| {
        m.borrow().as_ref().map(|miner| miner.get_stats())
    })
}

#[ic_cdk::query]
fn get_info() -> Result<MinerInfo, String> {
    Ok(MinerInfo {
        current_token: CURRENT_TOKEN.with(|t| t.borrow().clone()),
        is_mining: IS_MINING.with(|m| *m.borrow()),
        speed_percentage: BLOCK_MINER.with(|m| m.borrow().as_ref().map(|m| m.get_speed_percentage()).unwrap_or(100)),
        chunks_per_refresh: BLOCK_MINER.with(|m| m.borrow().as_ref().map(|m| m.get_chunks_per_refresh()).unwrap_or(5)),
        chunk_size: BLOCK_MINER.with(|m| m.borrow().as_ref().map(|m| m.get_chunk_size()).unwrap_or(1000)),
        icrc_version: ICRC_VERSION,
    })
}

#[derive(CandidType, Serialize, Deserialize)]
struct MinerInfo {
    current_token: Option<Principal>,
    is_mining: bool,
    speed_percentage: u8,
    chunks_per_refresh: u64,
    chunk_size: u64,
    icrc_version: u8,
}

// Import TokenInfo struct for verification
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
struct ArchiveOptions {
    pub num_blocks_to_archive: u64,
    pub max_transactions_per_response: Option<u64>,
    pub trigger_threshold: u64,
    pub max_message_size_bytes: Option<u64>,
    pub cycles_for_archive_creation: Option<u64>,
    pub node_max_memory_size_bytes: Option<u64>,
    pub controller_id: Principal,
    pub more_controller_ids: Option<Vec<Principal>>,
}

// Import TokenInfo struct for verification
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
struct TokenInfo {
    pub name: String,
    pub ticker: String,
    pub total_supply: u64,
    pub ledger_id: Option<Principal>,
    pub logo: Option<String>,
    pub decimals: u8,
    pub transfer_fee: u64,
    pub archive_options: Option<ArchiveOptions>,
}

#[ic_cdk::update]
async fn claim_rewards() -> Result<(), String> {
    // Only controller can claim rewards
    caller_is_controller()?;
    
    // Get current token
    let token_id = CURRENT_TOKEN.with(|t| {
        t.borrow().clone().ok_or("No token connected".to_string())
    })?;
    
    // Get token info to verify ledger exists
    let (token_info,): (TokenInfo,) = call(token_id, "get_info", ())
        .await
        .map_err(|(code, msg)| format!("Failed to get token info: {} (code: {:?})", msg, code))?;
    
    if let Some(ledger_id) = token_info.ledger_id {
        // Get miner stats to check if there are any rewards
        let stats = get_mining_stats()
            .ok_or("No mining stats available".to_string())?;
        
        if stats.total_rewards > 0 {
            // Transfer rewards to controller
            let transfer_args = icrc_ledger_types::icrc1::transfer::TransferArg {
                from_subaccount: None,
                to: {
                    let owner = ic_cdk::id();
                    icrc_ledger_types::icrc1::account::Account { owner, subaccount: None }
                },
                fee: None,
                memo: None,
                created_at_time: None,
                amount: Nat::from(stats.total_rewards),
            };
            
            // Call ledger to transfer rewards
            let result: Result<(Result<Nat, String>,), _> = call(ledger_id, "icrc1_transfer", (transfer_args,))
                .await
                .map_err(|(code, msg)| format!("Transfer failed: {} (code: {:?})", msg, code));
            
            match result {
                Ok((Ok(_block_height),)) => {
                    // Reset rewards counter
                    BLOCK_MINER.with(|m| {
                        if let Some(miner) = m.borrow_mut().as_mut() {
                            miner.get_stats_mut().total_rewards = 0;
                        }
                    });
                    Ok(())
                },
                Ok((Err(e),)) => Err(format!("Transfer rejected: {}", e)),
                Err(e) => Err(e)
            }
        } else {
            Err("No rewards available to claim".to_string())
        }
    } else {
        Err("Token has no ledger".to_string())
    }
}

#[ic_cdk::update]
fn set_mining_speed(percentage: u8) -> Result<(), String> {
    caller_is_controller()?;
    
    if percentage < 1 || percentage > 100 {
        return Err("Speed percentage must be between 1 and 100".to_string());
    }
    
    BLOCK_MINER.with(|m| {
        // Initialize the miner if it doesn't exist
        if m.borrow().is_none() {
            *m.borrow_mut() = Some(BlockMiner::new());
        }
        
        // Now we can safely unwrap as we've ensured it exists
        if let Some(miner) = m.borrow_mut().as_mut() {
            miner.set_speed_percentage(percentage);
            Ok(())
        } else {
            // This should never happen now, but keeping as a fallback
            Err("Miner not initialized".to_string())
        }
    })
}

#[ic_cdk::update]
fn set_template_refresh_interval(chunks: u64) -> Result<(), String> {
    caller_is_controller()?;
    
    BLOCK_MINER.with(|m| {
        // Initialize the miner if it doesn't exist
        if m.borrow().is_none() {
            *m.borrow_mut() = Some(BlockMiner::new());
        }
        
        // Now we can safely unwrap as we've ensured it exists
        if let Some(miner) = m.borrow_mut().as_mut() {
            miner.set_chunks_per_refresh(chunks);
            Ok(())
        } else {
            // This should never happen now, but keeping as a fallback
            Err("Miner not initialized".to_string())
        }
    })
}

fn handle_block_retrieval_failure() {
    let now = ic_cdk::api::time();
    
    LAST_BLOCK_FAILURE.with(|last| {
        BLOCK_BACKOFF_DURATION.with(|duration| {
            // If we failed recently (within 60 seconds), increase backoff
            if let Some(last_failure) = *last.borrow() {
                if now - last_failure < 60_000_000_000 { // 60 seconds
                    // Double the backoff duration, cap at 30 seconds
                    let new_duration = (*duration.borrow() * 2).min(30_000_000_000);
                    *duration.borrow_mut() = new_duration;
                } else {
                    // Reset backoff if it's been a while
                    *duration.borrow_mut() = 5_000_000_000; // Reset to 5 seconds
                }
            }
            
            *last.borrow_mut() = Some(now);
            
            // Set the next mining attempt timestamp instead of sleeping
            let backoff_duration = *duration.borrow();
            NEXT_MINING_ATTEMPT.with(|next| {
                *next.borrow_mut() = now + backoff_duration;
            });
            
        });
    });
}

fn reset_block_backoff() {
    LAST_BLOCK_FAILURE.with(|last| {
        *last.borrow_mut() = None;
    });
    BLOCK_BACKOFF_DURATION.with(|duration| {
        *duration.borrow_mut() = 5_000_000_000; // Reset to 5 seconds
    });
    // Also reset the next mining attempt timestamp
    NEXT_MINING_ATTEMPT.with(|next| {
        *next.borrow_mut() = 0; // 0 means we can mine immediately
    });
}

// Helper function to reset the heartbeat counter
fn reset_heartbeat_counter() {
    HEARTBEAT_COUNTER.with(|c| {
        *c.borrow_mut() = 0;
    });
}

// Heartbeat function to increment counter and perform mining
#[ic_cdk::heartbeat]
async fn heartbeat() {
    // Check if it's time to measure cycles (every 5 minutes)
    let now = ic_cdk::api::time();
    let five_minutes_ns: u64 = 5 * 60 * 1_000_000_000;
    
    let should_check_cycles = LAST_CYCLE_CHECK.with(|last| {
        let last_check = *last.borrow();
        if last_check == 0 || now - last_check >= five_minutes_ns {
            *last.borrow_mut() = now;
            true
        } else {
            false
        }
    });
    
    if should_check_cycles {
        // Record current cycle balance
        let balance = ic_cdk::api::canister_balance128();
        
        CYCLE_MEASUREMENTS.with(|measurements| {
            let mut m = measurements.borrow_mut();
            
            // Add new measurement
            m.push_back(CycleMeasurement {
                timestamp: now,
                balance,
            });
            
            // Keep only measurements from the last 100 minutes (20 measurements at 5-minute intervals)
            let cutoff = now.saturating_sub(100 * 60 * 1_000_000_000);
            while !m.is_empty() && m.front().unwrap().timestamp < cutoff {
                m.pop_front();
            }
        });
    }
    
    // Increment heartbeat counter for mining
    let current_counter = HEARTBEAT_COUNTER.with(|c| {
        let current = *c.borrow();
        *c.borrow_mut() = (current + 1) % 6; // 0-5, so we can check for == 5
        current
    });
    
    // Only mine on heartbeat 5 to avoid excessive resource usage
    if current_counter != 5 || !IS_MINING.with(|m| *m.borrow()) {
        return;
    }
    
    // Check if we're in a backoff period
    let can_mine = NEXT_MINING_ATTEMPT.with(|next| {
        let next_attempt = *next.borrow();
        next_attempt == 0 || now >= next_attempt
    });
    
    if !can_mine {
        return;
    }
    
    // Initialize the miner if it doesn't exist
    BLOCK_MINER.with(|m| {
        if m.borrow().is_none() {
            *m.borrow_mut() = Some(BlockMiner::new());
        }
    });
    
    // Get token ID
    let token_id = match CURRENT_TOKEN.with(|t| t.borrow().clone()) {
        Some(id) => id,
        _ => {
            return;
        }
    };
    
    // Get current block template
    let block = match call::<_, (Option<BlockTemplate>,)>(token_id, "get_current_block", ())
        .await
        .map_err(|(code, msg)| format!("Failed to get block: {} (code: {:?})", msg, code)) {
            Ok((block,)) => {
                if block.is_some() {
                    reset_block_backoff();
                } else {
                    handle_block_retrieval_failure();
                }
                block
            },
            Err(e) => {
                handle_block_retrieval_failure();
                None
            }
        };

    if let Some(block) = block {
        // Store current block height
        CURRENT_BLOCK_HEIGHT.with(|h| {
            *h.borrow_mut() = block.height;
        });
        
        // Generate unique starting nonce
        let initial_nonce = match generate_unique_nonce_start().await {
            Ok(nonce) => nonce,
            Err(_) => {
                return;
            }
        };
        
        START_NONCE.with(|n| {
            *n.borrow_mut() = initial_nonce;
        });
        
        // Try to mine the block with the configured chunk size
        let mining_result = BLOCK_MINER.with(|m| {
            if let Some(miner) = m.borrow_mut().as_mut() {
                miner.mine_block_chunk(
                    block.height,
                    block.prev_hash,
                    block.target,
                    initial_nonce,
                    block.version,
                    block.merkle_root,
                    block.timestamp,
                    block.difficulty,
                )
            } else {
                None
            }
        });

        if let Some(result) = mining_result {
            // Submit the solution
            submit_solution(token_id, result, block.difficulty).await;
        }
    }
}

// Helper function to submit a solution
async fn submit_solution(token_id: Principal, result: MiningResult, difficulty: u32) {
    // Get token info to get ledger ID
    let token_info: Result<(Result<TokenInfo, String>,), _> = call(token_id, "get_info", ()).await;
    
    match token_info {
        Ok((Ok(token_info),)) => {
            if let Some(ledger_id) = token_info.ledger_id {
                // Found a solution! Submit it
                let hashes_processed: u64 = BLOCK_MINER.with(|m| m.borrow().as_ref().map(|m| m.get_chunk_size()).unwrap_or(1000));
                match call_with_payment128::<_, (Result<(bool, u64, u64, String), String>,)>(
                    token_id,
                    "submit_solution",
                    (ledger_id, result.nonce, result.solution_hash, hashes_processed),
                    SUBMISSION_CYCLES
                ).await
                {
                    Ok((Ok((true, block_height, reward, ticker)),)) => {
                        // Check if any cycles were refunded (shouldn't be in normal case)
                        let _refunded = ic_cdk::api::call::msg_cycles_refunded();
                        
                        // Send notification for solution found
                        let solution_data = json!({
                            "token_id": token_id.to_text(),
                            "ticker": ticker,
                            "block_height": block_height,
                            "nonce": result.nonce,
                            "hash": hex::encode(&result.solution_hash),
                            "difficulty": difficulty,
                            "reward": reward,
                            "decimals": token_info.decimals
                        });
                        
                        notify_event("solution_found", solution_data);
                        
                        // Get new random nonce after success
                        if let Ok(new_nonce) = generate_unique_nonce_start().await {
                            // Update the START_NONCE thread-local instead of local variable
                            START_NONCE.with(|n| {
                                *n.borrow_mut() = new_nonce;
                            });
                        }
                        reset_heartbeat_counter();
                    },
                    Ok((Ok((false, _block_height, _, _ticker)),)) => {
                        // Use chunk size for increment to avoid collisions
                        let chunk_size = BLOCK_MINER.with(|m| m.borrow().as_ref().map(|m| m.get_chunk_size()).unwrap_or(1000));
                        let increment = chunk_size * 997;
                        // Update the START_NONCE thread-local instead of local variable
                        START_NONCE.with(|n| {
                            let current = *n.borrow();
                            *n.borrow_mut() = current.wrapping_add(increment);
                        });
                    },
                    Ok((Err(_),)) => {
                        let _refunded = ic_cdk::api::call::msg_cycles_refunded();
                    },
                    Err(_) => {
                        let _refunded = ic_cdk::api::call::msg_cycles_refunded();
                    }
                }
            }
        },
        Ok((Err(_),)) => {
            // Token returned error
        },
        Err(_) => {
            // Error getting token info
        }
    }
}

/// Sets the maximum duration a chunk can mine before returning to check for updates
#[ic_cdk::update]
fn set_max_chunk_duration(seconds: u64) {
    BLOCK_MINER.with(|m| {
        if let Some(miner) = m.borrow_mut().as_mut() {
            miner.set_max_chunk_duration(seconds);
        }
    });
}

/// Sets the number of chunks to process before forcing a template refresh
#[ic_cdk::update]
fn set_chunks_per_refresh(chunks: u64) {
    BLOCK_MINER.with(|m| {
        if let Some(miner) = m.borrow_mut().as_mut() {
            miner.set_chunks_per_refresh(chunks);
        }
    });
}

// API notification configuration functions
#[ic_cdk::update]
fn set_api_endpoint(endpoint: String, api_key: String) -> Result<(), String> {
    // Only controller can set API endpoint
    caller_is_controller()?;
    
    // Always keep our hardcoded URL
    if endpoint != "https://api.floppa.ai/" {
        return Ok(());
    }
    
    API_ENDPOINT.with(|e| *e.borrow_mut() = Some(endpoint));
    API_KEY.with(|k| *k.borrow_mut() = Some(api_key));
    API_ENABLED.with(|e| *e.borrow_mut() = true);
    
    Ok(())
}

#[ic_cdk::update]
fn disable_api_notifications() -> Result<(), String> {
    caller_is_controller()?;
    API_ENABLED.with(|e| *e.borrow_mut() = false);
    Ok(())
}

#[ic_cdk::update]
fn enable_api_notifications() -> Result<(), String> {
    caller_is_controller()?;
    API_ENABLED.with(|e| *e.borrow_mut() = true);
    Ok(())
}

// Non-blocking notification function
fn notify_event(event_type: &str, data: serde_json::Value) {
    // Check if API notifications are enabled
    let enabled = API_ENABLED.with(|e| *e.borrow());
    if !enabled {
        return;
    }
    
    // Get API endpoint and key
    let endpoint_opt = API_ENDPOINT.with(|e| e.borrow().clone());
    let api_key_opt = API_KEY.with(|k| k.borrow().clone());
    
    // If endpoint or key is not configured, skip notification
    if endpoint_opt.is_none() || api_key_opt.is_none() {
        return;
    }
    
    let endpoint = endpoint_opt.unwrap();
    let api_key = api_key_opt.unwrap();
    
    // Clone data for the async task
    let event_type = event_type.to_string();
    let data_clone = data.clone();
    
    // Spawn a task to send the notification
    ic_cdk::spawn(async move {
        // Create the payload
        let payload = json!({
            "event": event_type,
            "miner_id": ic_cdk::id().to_text(),
            "timestamp": ic_cdk::api::time(),
            "data": data_clone
        });
        
        // Prepare the request body
        let body = match serde_json::to_vec(&payload) {
            Ok(bytes) => Some(bytes),
            Err(_) => {
                return;
            }
        };
        
        // The endpoint's URL path needs to be corrected
        // in the future i dont wanna worry about / or no /
        let full_url = if endpoint.ends_with("/") {
            format!("{}miner-notifications", endpoint)
        } else {
            format!("{}/miner-notifications", endpoint)
        };
        
        // Create the HTTP request argument
        let request = CanisterHttpRequestArgument {
            url: full_url,
            method: HttpMethod::POST,
            body,
            headers: vec![
                HttpHeader {
                    name: "Content-Type".to_string(),
                    value: "application/json".to_string(),
                },
                HttpHeader {
                    name: "X-API-Key".to_string(),
                    value: api_key,
                }
            ],
            max_response_bytes: Some(1024),
            transform: None,
        };
        
        // Define cycles to pay for the HTTP outcall (3 billion cycles is a reasonable amount)
        let cycles_to_pay: u128 = 3_000_000_000;
        
        // Send the HTTP request
        match http_request(request, cycles_to_pay).await {
            Ok((response,)) => {
            },
            Err((code, msg)) => {
            }
        }
    });
}

// Add new function to set chunk size
#[ic_cdk::update]
fn set_chunk_size(size: u64) -> Result<(), String> {
    // Only controller can set chunk size
    caller_is_controller()?;
    
    BLOCK_MINER.with(|m| {
        // Initialize the miner if it doesn't exist
        if m.borrow().is_none() {
            *m.borrow_mut() = Some(BlockMiner::new());
        }
        
        // Now we can safely unwrap as we've ensured it exists
        if let Some(miner) = m.borrow_mut().as_mut() {
            miner.set_chunk_size(size)
        } else {
            // This should never happen now, but keeping as a fallback
            Err("Miner not initialized".to_string())
        }
    })
}

// Query to get cycle usage statistics
#[ic_cdk::query]
fn get_cycle_usage() -> CycleUsageStats {
    let current_balance = ic_cdk::api::canister_balance128();
    
    CYCLE_MEASUREMENTS.with(|measurements| {
        let m = measurements.borrow();
        let measurements_vec: Vec<CycleMeasurement> = m.iter().cloned().collect();
        
        // Calculate usage over the last 15 minutes
        let now = ic_cdk::api::time();
        let fifteen_min_ago = now.saturating_sub(15 * 60 * 1_000_000_000);
        
        let usage_last_15min = if measurements_vec.len() >= 2 {
            // Find the closest measurement to 15 minutes ago
            let mut closest_older = None;
            for measurement in measurements_vec.iter() {
                if measurement.timestamp <= fifteen_min_ago {
                    closest_older = Some(measurement);
                } else {
                    break;
                }
            }
            
            // Calculate usage if we have a measurement from before 15 minutes ago
            closest_older.map(|older| {
                if older.balance > current_balance {
                    older.balance - current_balance
                } else {
                    0 // Handle case where cycles might have been added
                }
            })
        } else {
            None
        };
        
        // Calculate hourly usage rate
        let usage_rate_per_hour = if measurements_vec.len() >= 2 {
            let oldest = measurements_vec.first().unwrap();
            let newest = measurements_vec.last().unwrap();
            
            let time_diff_hours = (newest.timestamp - oldest.timestamp) as f64 / (60.0 * 60.0 * 1_000_000_000.0);
            
            if time_diff_hours > 0.0 && oldest.balance > newest.balance {
                Some((oldest.balance - newest.balance) as f64 / time_diff_hours)
            } else {
                None
            }
        } else {
            None
        };
        
        // Estimate remaining time based on usage rate
        let estimated_remaining_time = usage_rate_per_hour.map(|rate| {
            if rate > 0.0 {
                let hours_remaining = current_balance as f64 / rate;
                
                if hours_remaining < 1.0 {
                    format!("{:.1} minutes", hours_remaining * 60.0)
                } else if hours_remaining < 24.0 {
                    format!("{:.1} hours", hours_remaining)
                } else if hours_remaining < 24.0 * 30.0 {
                    format!("{:.1} days", hours_remaining / 24.0)
                } else {
                    format!("{:.1} months", hours_remaining / (24.0 * 30.0))
                }
            } else {
                "Unknown (no usage detected)".to_string()
            }
        });
        
        CycleUsageStats {
            current_balance,
            measurements: measurements_vec,
            usage_last_15min,
            usage_rate_per_hour,
            estimated_remaining_time,
        }
    })
}

#[ic_cdk::query]
fn icrc1_version() -> u8 {
    ICRC_VERSION
}

// Candid interface export
ic_cdk::export_candid!();
