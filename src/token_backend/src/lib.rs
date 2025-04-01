// src/token_backend/src/lib.rs
use candid::Principal;
mod block_templates;
mod mining;
mod types;
mod standards;
mod statistics;
mod submit_solution;
mod transfer_to_miner;
mod memory;
mod start_token;

use block_templates::{BlockTemplate, Hash};
use crate::types::{ 
    SocialLink, 
    TokenAllInfo, AllInfoResult, MiningInfo,
    TokenInfo, TokenInitArgs, StorablePrincipal,
    MinerInfo, MinerStats, MinerStatus, TokenMetrics, MetricsResult
};

use crate::submit_solution::SolutionError;

#[ic_cdk::query]
fn icrc1_version() -> String {
    "v1".to_string()
}

// Make require_auth crate-public
pub(crate) fn require_auth() -> Result<Principal, String> {
    let _caller = ic_cdk::caller();
    if _caller == Principal::anonymous() {
        Err("Authentication required".to_string())
    } else {
        Ok(_caller)
    }
}

fn is_authenticated() -> bool {
    let caller = ic_cdk::caller();
    caller != Principal::anonymous()
}

// Get authentication status
#[ic_cdk::query]
fn get_auth_status() -> bool {
    is_authenticated()
}

// Init function to use memory module
// Store token state
#[ic_cdk_macros::init]
fn init(args: TokenInitArgs) {
    memory::init_memory();
    standards::init();
    let caller = ic_cdk::caller();
    memory::with_creator_mut(|creator_cell| {
        creator_cell.set(Some(StorablePrincipal(caller)))
            .expect("Failed to set creator");
    });
    memory::with_token_info_mut(|token_info_cell| {
        token_info_cell.set(Some(TokenInfo {
            name: args.name,
            ticker: args.ticker,
            total_supply: args.total_supply,
            ledger_id: None,
            logo: args.logo,
            decimals: args.decimals.unwrap_or(8),
            transfer_fee: args.transfer_fee.unwrap_or(1),
            archive_options: args.archive_options.clone(),
            social_links: args.social_links.clone(),
            average_block_time: None,
            current_block_reward: 0,
            current_block_height: 0,
        })).expect("Failed to set token info");
    });
    memory::with_circulating_supply_mut(|supply_cell| {
        supply_cell.set(0)
            .expect("Failed to init circulating supply");
    });
    mining::init_mining_params(
        args.initial_block_reward,
        args.block_time_target_seconds,
        args.halving_interval
    );
    ic_cdk::println!("Token backend initialized...");
}

// Update get_info to use stable cell
#[ic_cdk::query]
fn get_info() -> Result<TokenInfo, String> {
    let mut token_info = memory::with_token_info(|info_opt| {
        info_opt.as_ref().cloned()
            .ok_or_else(|| "Token not initialized".to_string())
    })?;
    let block_height = statistics::get_block_height();
    token_info.current_block_height = block_height;
    let mining_stats_info = statistics::get_mining_info();
    token_info.current_block_reward = mining_stats_info.current_block_reward;
    token_info.average_block_time = match statistics::get_average_block_time(None) {
        statistics::BlockTimeResult::Ok(avg_time) => Some(avg_time),
        statistics::BlockTimeResult::Err(_) => None,
    };
    Ok(token_info)
}

// Get caller's principal
#[ic_cdk::query]
fn whoami() -> Principal {
    ic_cdk::caller()
}

// Update get_metrics to handle references properly
#[ic_cdk::query]
fn get_metrics() -> MetricsResult {
    let total_supply = match memory::with_token_info(|info_opt| info_opt.as_ref().map(|info| info.total_supply)) {
        Some(supply) => supply,
        _ => return MetricsResult::Err("Token not initialized".to_string()),
    };
    let circulating_supply = memory::with_circulating_supply(|supply| *supply);
    MetricsResult::Ok(TokenMetrics { total_supply, circulating_supply })
}

// Update circulating supply helper
pub(crate) fn update_circulating_supply(amount: u64) {
    memory::with_circulating_supply_mut(|supply_cell| {
        let current = *supply_cell.get();
        let new_supply = current.checked_add(amount).expect("Circulating supply overflow");
        supply_cell.set(new_supply)
            .expect("Failed to update circulating supply");
    });
}

// Re-export mining functions
pub use mining::{
    generate_new_block,
    create_genesis_block,
    get_current_block,
};

// Re-export statistics functions
pub use statistics::{
    get_mining_difficulty,
    get_mining_info,
    get_average_block_time,
    BlockTimeResult,
    get_block_height,
    get_block_time_target,
};

// Re-export start_token function
pub use start_token::start_token;

// Re-export submit solution function
pub use submit_solution::submit_solution;

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

// Miner management functions
#[ic_cdk::update]
async fn register_miner() -> Result<(), String> {
    let caller = require_auth()?;
    if !caller.to_text().ends_with("-cai") {
        return Err("Only canister principals can register as miners".to_string());
    }
    let now = ic_cdk::api::time();
    let storable_caller = StorablePrincipal(caller);
    memory::with_miners_map_mut(|miners_map| {
        if let Some(mut info) = miners_map.get(&storable_caller) {
            info.status = MinerStatus::Active;
            info.last_status_change = now;
            miners_map.insert(storable_caller, info);
            ic_cdk::println!("Miner {} reactivated.", caller);
        } else {
            let miner_info = MinerInfo {
                principal: caller,
                status: MinerStatus::Active,
                stats: MinerStats::default(),
                registration_time: now,
                last_status_change: now,
            };
            miners_map.insert(storable_caller, miner_info);
            ic_cdk::println!("New miner {} registered.", caller);
        }
    });
    Ok(())
}

#[ic_cdk::update]
fn deregister_miner() -> Result<(), String> {
    let caller = require_auth()?;
    let storable_caller = StorablePrincipal(caller);
    memory::with_miners_map_mut(|miners_map| {
        if let Some(mut info) = miners_map.get(&storable_caller) {
            info.status = MinerStatus::Inactive;
            info.last_status_change = ic_cdk::api::time();
            miners_map.insert(storable_caller, info);
            ic_cdk::println!("Miner {} deregistered.", caller);
        } else {
            ic_cdk::println!("Attempted to deregister non-existent miner {}.", caller);
        }
    });
    Ok(())
}

#[ic_cdk::query]
fn get_miners() -> Vec<MinerInfo> {
    memory::with_miners_map(|miners_map| {
        miners_map.iter().map(|(_, info)| info.clone()).collect()
    })
}

#[ic_cdk::query]
fn get_active_miners() -> Vec<Principal> {
    memory::with_miners_map(|miners_map| {
        miners_map.iter()
            .filter(|(_, info)| matches!(info.status, MinerStatus::Active))
            .map(|(principal, _)| principal.0)
            .collect()
    })
}

// Helper function to update miner stats
pub(crate) fn update_miner_stats(miner: Principal, reward: u64) {
    let now = ic_cdk::api::time();
    let storable_miner = StorablePrincipal(miner);
    memory::with_miners_map_mut(|miners_map| {
        if let Some(mut info) = miners_map.get(&storable_miner) {
            info.stats.blocks_mined = info.stats.blocks_mined.checked_add(1).expect("Miner blocks_mined overflow");
            info.stats.total_rewards = info.stats.total_rewards.checked_add(reward).expect("Miner total_rewards overflow");
            info.stats.last_block_timestamp = Some(now);
            if info.stats.first_block_timestamp.is_none() {
                info.stats.first_block_timestamp = Some(now);
            }
            miners_map.insert(storable_miner, info);
        } else {
             ic_cdk::println!("Attempted to update stats for non-existent miner {}", miner);
        }
    });
}

#[ic_cdk::query]
fn get_miner_stats(miner: Principal) -> Option<MinerInfo> {
    memory::with_miners_map(|miners_map| {
        miners_map.get(&StorablePrincipal(miner))
    })
}

#[ic_cdk::query]
fn get_miner_leaderboard(limit: Option<u32>) -> Vec<MinerInfo> {
    let limit = limit.unwrap_or(10) as usize;
    memory::with_miners_map(|miners_map| {
        let mut result: Vec<MinerInfo> = miners_map.iter().map(|(_, info)| info.clone()).collect();
        result.sort_by(|a, b| b.stats.blocks_mined.cmp(&a.stats.blocks_mined));
        result.truncate(limit);
        result
    })
}

// Social links management functions
#[ic_cdk::query]
fn get_social_links() -> Result<Vec<SocialLink>, String> {
    memory::with_token_info(|info_opt| {
        info_opt.as_ref()
            .ok_or_else(|| "Token not initialized".to_string())
            .map(|token_info| token_info.social_links.clone().unwrap_or_default())
    })
}

#[ic_cdk::update]
fn add_social_link(platform: String, url: String) -> Result<(), String> {
    let caller = require_auth()?;
    memory::with_token_info_mut(|token_info_cell| {
        let mut current_info = token_info_cell.get().clone()
            .ok_or_else(|| "Token not initialized".to_string())?;
        let is_creator = memory::with_creator(|creator_opt| {
            creator_opt.as_ref().map(|p| p.0) == Some(caller)
        });
        if !is_creator { return Err("Only creator can modify social links".to_string()); }
        let mut links = current_info.social_links.take().unwrap_or_default();
        links.push(SocialLink { platform, url });
        current_info.social_links = Some(links);
        token_info_cell.set(Some(current_info))
            .map_err(|e| format!("Failed to update token info: {:?}", e))?;
        Ok(())
    })
}

#[ic_cdk::update]
fn update_social_link(index: usize, platform: String, url: String) -> Result<(), String> {
    let caller = require_auth()?;
    memory::with_token_info_mut(|token_info_cell| {
        let mut current_info = token_info_cell.get().clone()
            .ok_or_else(|| "Token not initialized".to_string())?;
        let is_creator = memory::with_creator(|creator_opt| {
            creator_opt.as_ref().map(|p| p.0) == Some(caller)
        });
        if !is_creator { return Err("Only creator can modify social links".to_string()); }
        let mut links = current_info.social_links.take().unwrap_or_default();
        if index >= links.len() { return Err(format!("Social link index {} out of bounds", index)); }
        links[index] = SocialLink { platform, url };
        current_info.social_links = Some(links);
        token_info_cell.set(Some(current_info))
            .map_err(|e| format!("Failed to update token info: {:?}", e))?;
        Ok(())
    })
}

#[ic_cdk::update]
fn remove_social_link(index: usize) -> Result<(), String> {
    let caller = require_auth()?;
    memory::with_token_info_mut(|token_info_cell| {
        let mut current_info = token_info_cell.get().clone()
            .ok_or_else(|| "Token not initialized".to_string())?;
        let is_creator = memory::with_creator(|creator_opt| {
            creator_opt.as_ref().map(|p| p.0) == Some(caller)
        });
        if !is_creator { return Err("Only creator can modify social links".to_string()); }
        let mut links = current_info.social_links.take().unwrap_or_default();
        if index >= links.len() { return Err(format!("Social link index {} out of bounds", index)); }
        links.remove(index);
        current_info.social_links = Some(links);
        token_info_cell.set(Some(current_info))
            .map_err(|e| format!("Failed to update token info: {:?}", e))?;
        Ok(())
    })
}

// pre_upgrade
#[ic_cdk_macros::pre_upgrade]
fn pre_upgrade() {
    ic_cdk::println!("Pre-upgrade: Preparing for canister upgrade");
}

// post_upgrade
#[ic_cdk_macros::post_upgrade]
fn post_upgrade() {
    memory::init_memory();
    mining::initialize_memory();
    let difficulty = statistics::get_mining_difficulty();
    let block_time = statistics::get_block_time_target();
    let mining_stats_info = statistics::get_mining_info();
    ic_cdk::println!("Post-upgrade: Mining parameters - difficulty: {}, block_time_target: {}",
        difficulty, block_time);
    ic_cdk::println!("Post-upgrade: Mining info: {:?}", mining_stats_info);
    ic_cdk::println!("Post-upgrade: Memory module and mining memory re-initialized");
}

// New comprehensive query that returns all token info in one call
#[ic_cdk::query]
fn get_all_info() -> AllInfoResult {
    let token_info = match get_info() { Ok(info) => info, Err(e) => return AllInfoResult::Err(e) };
    let metrics = match get_metrics() { MetricsResult::Ok(m) => m, MetricsResult::Err(e) => return AllInfoResult::Err(e) };
    let mining_stats_info = statistics::get_mining_info();
    let avg_block_time = token_info.average_block_time;
    let principal = ic_cdk::id();
    AllInfoResult::Ok(TokenAllInfo {
        name: token_info.name,
        ticker: token_info.ticker,
        total_supply: token_info.total_supply,
        ledger_id: token_info.ledger_id,
        logo: token_info.logo,
        decimals: token_info.decimals,
        transfer_fee: token_info.transfer_fee,
        social_links: token_info.social_links,
        average_block_time: avg_block_time,
        circulating_supply: metrics.circulating_supply,
        current_block_reward: mining_stats_info.current_block_reward,
        canister_id: principal,
        current_block_height: token_info.current_block_height,
    })
}

// Candid interface export
ic_cdk::export_candid!();