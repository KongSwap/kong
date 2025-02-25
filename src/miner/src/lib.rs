// src/miner/src/lib.rs

use candid::{CandidType, Principal, Nat};
use ic_cdk::api::call::call;
use ic_cdk::api::call::call_with_payment128;
use ic_cdk::api::management_canister::main::raw_rand;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use hex;

mod block_miner;
use block_miner::{BlockMiner, MiningStats, Hash};

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
}

#[derive(CandidType, Serialize, Deserialize)]
struct MinerInitArgs {}

#[ic_cdk::init]
fn init(_args: MinerInitArgs) {
    // Initialize block miner with default chunk size
    BLOCK_MINER.with(|miner| {
        *miner.borrow_mut() = Some(BlockMiner::new(50_000)); // Start with Normal miner settings
    });
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
                            ic_cdk::println!("Connected to token: {}", token_id.to_text());
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
        let deregister_result: Result<((),), (ic_cdk::api::call::RejectionCode, String)> = 
            call(token_id, "deregister_miner", ()).await;
            
        match deregister_result {
            Ok(_) => (),
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
    
    // Get current block from token
    let (block,): (Option<BlockTemplate>,) = call(token_id, "get_current_block", ())
        .await
        .map_err(|(code, msg)| format!("Failed to get block: {} (code: {:?})", msg, code))?;
    
    let block = block.ok_or("No block available to mine".to_string())?;
    
    // Store current block height
    CURRENT_BLOCK_HEIGHT.with(|h| {
        *h.borrow_mut() = block.height;
    });
    
    // Generate unique starting nonce
    let initial_nonce = match generate_unique_nonce_start().await {
        Ok(nonce) => nonce,
        Err(e) => {
            ic_cdk::println!("Failed to generate nonce: {}", e);
            return Ok(());
        }
    };
    
    START_NONCE.with(|n| {
        *n.borrow_mut() = initial_nonce;
    });
    
    // Start mining
    IS_MINING.with(|m| {
        *m.borrow_mut() = true;
    });
    
    // Start mining loop in the background
    let token_id_clone = token_id;
    ic_cdk::spawn(async move {
        while IS_MINING.with(|m| *m.borrow()) {
            // ALWAYS check difficulty before mining - no more "when we feel like it"
            let current_difficulty = match call::<_, (u32,)>(token_id_clone, "get_mining_difficulty", ())
                .await
            {
                Ok((new_difficulty,)) => {
                    // Update miner's difficulty tracking
                    BLOCK_MINER.with(|m| {
                        if let Some(miner) = m.borrow_mut().as_mut() {
                            miner.set_current_difficulty(new_difficulty);
                        }
                    });
                    new_difficulty
                },
                Err((code, msg)) => {
                    ic_cdk::println!("Failed to get difficulty: {} (code: {:?})", msg, code);
                    continue;
                }
            };
            
            // Check if we can submit before mining
            let can_submit: Result<bool, String> = match call::<_, (Result<bool, String>,)>(token_id_clone, "can_submit_solution", ())
                .await
            {
                Ok((result,)) => result,
                Err((code, msg)) => {
                    ic_cdk::println!("Failed to check submission status: {} (code: {:?})", msg, code);
                    Ok(false) // Assume we can't submit if check fails
                }
            };

            // If we can't submit, apply backoff and continue
            if let Ok(false) = can_submit {
                BLOCK_MINER.with(|m| {
                    if let Some(miner) = m.borrow_mut().as_mut() {
                        miner.handle_rate_limit();
                    }
                });
                continue;
            }

            // Get current block template
            let block = match call::<_, (Option<BlockTemplate>,)>(token_id_clone, "get_current_block", ())
                .await
                .map_err(|(code, msg)| format!("Failed to get block: {} (code: {:?})", msg, code)) {
                    Ok((block,)) => {
                        if block.is_some() {
                            reset_block_backoff();
                        } else {
                            ic_cdk::println!("No block available to mine");
                            handle_block_retrieval_failure();
                        }
                        block
                    },
                    Err(e) => {
                        ic_cdk::println!("Error getting block: {}", e);
                        handle_block_retrieval_failure();
                        None
                    }
                };

            if let Some(mut block) = block {
                // Store current block height
                CURRENT_BLOCK_HEIGHT.with(|h| {
                    *h.borrow_mut() = block.height;
                });
                
                // Generate unique starting nonce
                let initial_nonce = match generate_unique_nonce_start().await {
                    Ok(nonce) => nonce,
                    Err(e) => {
                        ic_cdk::println!("Failed to generate nonce: {}", e);
                        return;
                    }
                };
                
                START_NONCE.with(|n| {
                    *n.borrow_mut() = initial_nonce;
                });
                
                // Start mining
                IS_MINING.with(|m| {
                    *m.borrow_mut() = true;
                });
                
                // Start mining loop in the background
                let token_id_clone = token_id;
                ic_cdk::spawn(async move {
                    let mut current_nonce = initial_nonce;
                    let start_time = ic_cdk::api::time();
                    let mut hashes_processed = 0;
                    
                    while IS_MINING.with(|m| *m.borrow()) {
                        // ALWAYS get a fresh template if difficulty changed - no exceptions!
                        // This ensures target hash and difficulty stay in sync
                        let needs_refresh = current_difficulty != block.difficulty || BLOCK_MINER.with(|m| {
                            m.borrow().as_ref().map(|miner| miner.needs_template_refresh()).unwrap_or(true)
                        });

                        if needs_refresh {
                            match call::<_, (Option<BlockTemplate>,)>(token_id_clone, "get_current_block", ())
                                .await
                            {
                                Ok((Some(new_block),)) => {
                                    // Reset template refresh counter
                                    BLOCK_MINER.with(|m| {
                                        if let Some(miner) = m.borrow_mut().as_mut() {
                                            miner.reset_chunk_counter();
                                        }
                                    });

                                    if new_block.height != block.height {
                                        // New block, get new random nonce
                                        if let Ok(new_nonce) = generate_unique_nonce_start().await {
                                            current_nonce = new_nonce;
                                        }
                                        CURRENT_BLOCK_HEIGHT.with(|h| {
                                            *h.borrow_mut() = new_block.height;
                                        });
                                        ic_cdk::println!("Mining new block {} with difficulty {}", new_block.height, new_block.difficulty);
                                    } else if new_block.difficulty != block.difficulty {
                                        ic_cdk::println!("Block {} difficulty changed: {} -> {}", 
                                            new_block.height, 
                                            block.difficulty, 
                                            new_block.difficulty
                                        );
                                    }
                                    block = new_block;
                                },
                                Ok((None,)) => {
                                    ic_cdk::println!("No block available to mine");
                                    // Let IC's DTS handle the scheduling
                                    continue;
                                },
                                Err((code, msg)) => {
                                    ic_cdk::println!("Error getting block: {} (code: {:?})", msg, code);
                                    // Let IC's DTS handle the scheduling
                                    continue;
                                }
                            }
                        }
                        
                        // Try to mine the block - now we KNOW we have current difficulty
                        let mining_result = BLOCK_MINER.with(|m| {
                            if let Some(miner) = m.borrow_mut().as_mut() {
                                miner.mine_block_chunk(
                                    block.height,
                                    block.prev_hash,
                                    block.target,
                                    current_nonce,
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
                            // Convert hash to hex string for logging
                            let hash_hex = hex::encode(result.solution_hash);
                            ic_cdk::println!("Found solution for block {}: nonce={}, hash={}", 
                                result.block_height, 
                                result.nonce, 
                                hash_hex
                            );
                            
                            // Get token info to get ledger ID
                            let token_info: Result<(Result<TokenInfo, String>,), _> = call(token_id_clone, "get_info", ()).await;
                            
                            match token_info {
                                Ok((Ok(token_info),)) => {
                                    if let Some(ledger_id) = token_info.ledger_id {
                                        // Found a solution! Submit it
                                        let current_chunk_size = BLOCK_MINER.with(|m| m.borrow().as_ref().map(|m| m.get_current_chunk_size()).unwrap_or(1000));
                                        match call_with_payment128::<_, (Result<bool, String>,)>(
                                            token_id_clone,
                                            "submit_solution",
                                            (ledger_id, result.nonce, result.solution_hash, current_chunk_size),
                                            SUBMISSION_CYCLES
                                        ).await
                                        {
                                            Ok((Ok(true),)) => {
                                                // Check if any cycles were refunded (shouldn't be in normal case)
                                                let refunded = ic_cdk::api::call::msg_cycles_refunded();
                                                if refunded > 0 {
                                                    ic_cdk::println!("Warning: {} cycles were refunded from submission", refunded);
                                                }
                                                ic_cdk::println!("Solution accepted for block {}!", result.block_height);
                                                // Get new random nonce after success
                                                if let Ok(new_nonce) = generate_unique_nonce_start().await {
                                                    current_nonce = new_nonce;
                                                }
                                            },
                                            Ok((Ok(false),)) => {
                                                ic_cdk::println!("Solution rejected for block {}", result.block_height);
                                                // Use large increment to avoid collisions
                                                let increment = BLOCK_MINER.with(|m| m.borrow().as_ref().map(|m| m.get_current_chunk_size()).unwrap_or(1000)) * 997;
                                                current_nonce = current_nonce.wrapping_add(increment);
                                            },
                                            Ok((Err(e),)) => {
                                                let refunded = ic_cdk::api::call::msg_cycles_refunded();
                                                ic_cdk::println!(
                                                    "Error submitting solution: {} (refunded {} cycles)",
                                                    e,
                                                    refunded
                                                );
                                            },
                                            Err((code, msg)) => {
                                                let refunded = ic_cdk::api::call::msg_cycles_refunded();
                                                ic_cdk::println!(
                                                    "Error calling submit_solution: {} (code: {:?}, refunded {} cycles)",
                                                    msg,
                                                    code,
                                                    refunded
                                                );
                                            }
                                        }
                                    } else {
                                        ic_cdk::println!("Token has no ledger ID");
                                    }
                                },
                                Ok((Err(e),)) => {
                                    ic_cdk::println!("Token returned error: {}", e);
                                },
                                Err((code, msg)) => {
                                    ic_cdk::println!("Error getting token info: {} (code: {:?})", msg, code);
                                }
                            }
                        } else {
                            // No solution found, increment by chunk_size * prime to avoid collisions
                            let increment = BLOCK_MINER.with(|m| m.borrow().as_ref().map(|m| m.get_current_chunk_size()).unwrap_or(1000)) * 997;
                            current_nonce = current_nonce.wrapping_add(increment);
                        }
                        
                        let current_chunk_size = BLOCK_MINER.with(|m| m.borrow().as_ref().map(|m| m.get_current_chunk_size()).unwrap_or(1000));
                        hashes_processed += current_chunk_size;
                        if hashes_processed % 10_000_000 == 0 {
                            let elapsed = (ic_cdk::api::time() - start_time) as f64 / 1_000_000_000.0;
                            let hash_rate = hashes_processed as f64 / elapsed;
                            
                            // Get current miner type and speed
                            let (miner_type, speed) = BLOCK_MINER.with(|m| {
                                if let Some(miner) = m.borrow().as_ref() {
                                    (miner.get_type(), miner.get_speed_percentage())
                                } else {
                                    (block_miner::MinerType::Normal, 100)
                                }
                            });
                            
                            ic_cdk::println!(
                                "Mining stats: [{:?} @ {}%] {} MH/s | Block {} @ difficulty {}", 
                                miner_type,
                                speed,
                                hash_rate / 1_000_000.0,
                                block.height,
                                block.difficulty
                            );
                        }
                    }
                });
            }
        }
    });
    
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
        miner_type: BLOCK_MINER.with(|m| m.borrow().as_ref().map(|m| m.get_type()).unwrap_or(block_miner::MinerType::Normal)),
        speed_percentage: BLOCK_MINER.with(|m| m.borrow().as_ref().map(|m| m.get_speed_percentage()).unwrap_or(100)),
        chunks_per_refresh: BLOCK_MINER.with(|m| m.borrow().as_ref().map(|m| m.get_chunks_per_refresh()).unwrap_or(5)),
    })
}

#[derive(CandidType, Serialize, Deserialize)]
struct MinerInfo {
    current_token: Option<Principal>,
    is_mining: bool,
    miner_type: block_miner::MinerType,
    speed_percentage: u8,
    chunks_per_refresh: u64,
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
        if let Some(miner) = m.borrow_mut().as_mut() {
            miner.set_speed_percentage(percentage);
            Ok(())
        } else {
            Err("Miner not initialized".to_string())
        }
    })
}

#[ic_cdk::update]
fn set_template_refresh_interval(chunks: u64) -> Result<(), String> {
    caller_is_controller()?;
    
    BLOCK_MINER.with(|m| {
        if let Some(miner) = m.borrow_mut().as_mut() {
            miner.set_chunks_per_refresh(chunks);
            ic_cdk::println!("Set template refresh interval to {} chunks", chunks);
            Ok(())
        } else {
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
            
            // Log and sleep
            ic_cdk::println!(
                "Block retrieval failed - backing off for {:.1} seconds",
                *duration.borrow() as f64 / 1_000_000_000.0
            );
            
            std::thread::sleep(std::time::Duration::from_nanos(*duration.borrow()));
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
}

// Candid interface export
ic_cdk::export_candid!();
