use candid::{Principal, encode_args, Decode, CandidType, Nat};
use pocket_ic::{PocketIc, management_canister::CanisterSettings};
use serde::Deserialize;
use std::path::{Path, PathBuf};
use std::fs;
use std::env;

// Global test configuration constants
const TOTAL_HALVINGS: u64 = 20;             // Number of halvings to test
const NUM_MINERS: usize = 5;                // Number of miners to create
const TOKEN_DECIMALS: u32 = 8;              // Token decimals (e8)
const TOKEN_TOTAL_SUPPLY: u64 = 21_000_000; // Total supply (before applying decimals)
const INITIAL_BLOCK_REWARD: u64 = 50;       // Initial block reward (before applying decimals)
const HALVING_INTERVAL: u64 = 10;           // Number of blocks between halvings
const BLOCK_TIME_TARGET_SECONDS: u64 = 60;  // Target time between blocks
const TRANSFER_FEE: u64 = 10_000;           // Token transfer fee
const FIRST_MINER_CHUNK_SIZE: u64 = 10_000; // Chunk size for the first miner (10x default)

// Define the interfaces for the token and miner canisters
#[derive(Deserialize, Debug, CandidType)]
struct TokenMetadata {
    name: String,
    symbol: String,
    decimals: u8,
    fee: u64,
    total_supply: u64,
}

#[derive(Deserialize, Debug, CandidType)]
struct MinerInfo {
    owner: Principal,
    token_id: Principal,
    total_rewards: u64,
}

// Define BlockTemplate struct for decoding block height
#[derive(Deserialize, CandidType, Debug)]
struct BlockTemplate {
    height: u64,
    // Add other fields as needed
    #[serde(default)]
    parent_hash: Option<Vec<u8>>,
    #[serde(default)]
    timestamp: u64,
}

// Define MinerInitArgs struct - remove the chunk_size field
#[derive(CandidType)]
struct MinerInitArgs {}

fn get_workspace_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .parent()
        .unwrap()
        .to_path_buf()
}

fn check_wasm_files() -> bool {
    let workspace_root = get_workspace_root();
    let token_wasm_path = workspace_root.join("src/kong_svelte/static/wasms/token_backend/token_backend.wasm");
    let miner_wasm_path = workspace_root.join("src/kong_svelte/static/wasms/miner/miner.wasm");
    
    token_wasm_path.exists() && miner_wasm_path.exists()
}

fn load_wasm(path: &str) -> Vec<u8> {
    let workspace_root = get_workspace_root();
    let wasm_path = workspace_root.join(path);
    fs::read(&wasm_path)
        .unwrap_or_else(|e| panic!("Failed to load wasm from {}: {}", wasm_path.display(), e))
}

fn get_balance(pic: &PocketIc, token_id: Principal, owner: Principal) -> u64 {
    // First get the ledger ID from the token canister
    #[derive(Deserialize, CandidType, Debug)]
    struct TokenInfo {
        decimals: u8,
        ticker: String,
        transfer_fee: u64,
        logo: Option<String>,
        name: String,
        ledger_id: Option<Principal>,
        archive_options: Option<()>,
        total_supply: u64,
        social_links: Option<Vec<()>>,
    }
    
    #[derive(Deserialize, CandidType, Debug)]
    enum TokenInfoResult {
        Ok(TokenInfo),
        Err(String),
    }
    
    // Query the token canister for info
    let info_args = encode_args(()).unwrap();
    let info_bytes = pic.query_call(token_id, Principal::anonymous(), "get_info", info_args)
        .expect("Failed to query get_info");
    
    // Decode as a variant
    let token_info_variant: TokenInfoResult = Decode!(&info_bytes, TokenInfoResult).unwrap();
    
    match token_info_variant {
        TokenInfoResult::Ok(info) => {
            let ledger_id = info.ledger_id.expect("Token has no ledger ID");
            query_balance(pic, ledger_id, owner)
        },
        TokenInfoResult::Err(e) => panic!("Token info error: {}", e),
    }
}

fn query_balance(pic: &PocketIc, ledger_id: Principal, owner: Principal) -> u64 {
    // Query the ledger for balance
    #[derive(Deserialize, CandidType)]
    struct Account {
        owner: Principal,
        subaccount: Option<[u8; 32]>,
    }
    
    let account = Account {
        owner,
        subaccount: None,
    };
    
    let balance_args = encode_args((account,)).unwrap();
    let balance_bytes = pic.query_call(ledger_id, Principal::anonymous(), "icrc1_balance_of", balance_args)
        .expect("Failed to query icrc1_balance_of");
    
    // Decode as Nat first, then convert to u64
    let balance_nat: Nat = Decode!(&balance_bytes, Nat).unwrap();
    balance_nat.0.to_string().parse::<u64>().expect("Balance too large for u64")
}

// Add this helper function to format token amounts
fn format_token_amount(amount: u64, decimals: u32) -> String {
    let divisor = 10u64.pow(decimals);
    let whole_part = amount / divisor;
    let decimal_part = amount % divisor;
    
    // Format with proper padding for decimal part
    format!("{}.{:0width$}", whole_part, decimal_part, width = decimals as usize)
}

#[test]
fn test_mining_flow_multiple_miners() {
    println!("Starting mining flow test with multiple miners...");
    
    // Check if WASM files exist
    if !check_wasm_files() {
        panic!("Wasm files not found. Please run ./scripts/launchpad/get_latest_wasms.sh first");
    }
    
    // Run the full test
    match run_full_test() {
        Ok(_) => println!("Full test completed successfully!"),
        Err(e) => {
            panic!("Mining flow test failed: {}", e);
        }
    }
}

fn run_full_test() -> Result<(), String> {
    // Create a new PocketIC instance
    let pic = PocketIc::new();
    
    // Create principals for the test
    let admin = Principal::from_text("rrkah-fqaaa-aaaaa-aaaaq-cai").unwrap();
    
    // Create user principals
    let mut users = Vec::with_capacity(NUM_MINERS);
    for i in 0..NUM_MINERS {
        // Generate deterministic principals for testing
        // Note: In a real scenario, you'd want to use actual different principals
        let user = Principal::from_text(format!("renrk-eyaaa-aaaaa-aaa{:02}-cai", i).as_str())
            .unwrap_or(Principal::from_text("renrk-eyaaa-aaaaa-aaada-cai").unwrap());
        users.push(user);
    }
    
    // Load WASM modules
    let token_wasm = load_wasm("src/kong_svelte/static/wasms/token_backend/token_backend.wasm");
    let miner_wasm = load_wasm("src/kong_svelte/static/wasms/miner/miner.wasm");
    
    // Create token canister explicitly setting admin as controller
    let token_id = pic.create_canister_with_settings(
        Some(admin),
        Some(CanisterSettings {
            controllers: Some(vec![admin]),
            ..Default::default()
        }),
    );
    pic.add_cycles(token_id, 2_000_000_000_000);
    
    #[derive(CandidType)]
    struct TokenInitArgs {
        name: String,
        ticker: String,
        decimals: Option<u8>,
        total_supply: u64,
        initial_block_reward: u64,
        block_time_target_seconds: u64,
        halving_interval: u64,
        transfer_fee: Option<u64>,
        logo: Option<String>,
        archive_options: Option<()>,
        social_links: Option<Vec<()>>,
    }
    
    let token_args = encode_args((TokenInitArgs {
        name: "Test Token".to_string(),
        ticker: "TST".to_string(),
        decimals: Some(TOKEN_DECIMALS as u8),
        total_supply: TOKEN_TOTAL_SUPPLY * 10u64.pow(TOKEN_DECIMALS),        // Properly e8 encoded
        initial_block_reward: INITIAL_BLOCK_REWARD * 10u64.pow(TOKEN_DECIMALS),      // Properly e8 encoded
        block_time_target_seconds: BLOCK_TIME_TARGET_SECONDS,
        halving_interval: HALVING_INTERVAL,  // Changed from 210000 to 100 for faster testing
        transfer_fee: Some(TRANSFER_FEE),
        logo: None,
        archive_options: None,
        social_links: None,
    },)).unwrap();
    
    // Install the token canister
    pic.install_canister(token_id, token_wasm, token_args, Some(admin));
    
    // Start the token
    let start_token_args = encode_args(()).unwrap();
    let start_result = pic.update_call(token_id, admin, "start_token", start_token_args)
        .expect("Failed to call start_token");
    
    println!("start_token succeeded with {} bytes", start_result.len());
    
    // Decode the ledger ID from the response
    #[derive(Deserialize, CandidType, Debug)]
    enum StartTokenResult {
        Ok(Principal),
        Err(String),
    }
    
    let result: StartTokenResult = Decode!(&start_result, StartTokenResult).unwrap();
    match result {
        StartTokenResult::Ok(ledger_id) => {
            println!("Ledger ID from start_token: {}", ledger_id.to_text());
        },
        StartTokenResult::Err(e) => {
            println!("start_token error: {}", e);
        }
    }
    
    // Advance time to allow ledger to initialize
    pic.advance_time(std::time::Duration::from_secs(30));
    
    // Create and initialize miners
    println!("Creating and initializing {} miners...", NUM_MINERS);
    let mut miner_ids = Vec::with_capacity(NUM_MINERS);
    let empty_args = encode_args((MinerInitArgs{},)).unwrap();
    
    for (i, user) in users.iter().enumerate() {
        // Create miner canister
        let miner_id = pic.create_canister_with_settings(
            Some(*user),
            Some(CanisterSettings {
                controllers: Some(vec![*user]),
                ..Default::default()
            }),
        );
        pic.add_cycles(miner_id, 2_000_000_000_000);
        
        // Install miner wasm with default args
        pic.install_canister(miner_id, miner_wasm.clone(), empty_args.clone(), Some(*user));
        
        // Connect miner to token
        let connect_args = encode_args((token_id,)).unwrap();
        pic.update_call(miner_id, *user, "connect_token", connect_args)
            .expect(&format!("Failed to call connect_token for miner {}", i));
        
        miner_ids.push(miner_id);
        
        if i % 10 == 0 || i == NUM_MINERS - 1 {
            println!("Initialized {} miners...", i + 1);
        }
    }
    println!("All {} miners initialized successfully!", NUM_MINERS);
    
    // Set a larger chunk size for the first miner AFTER initialization
    let set_chunk_size_args = encode_args((FIRST_MINER_CHUNK_SIZE,)).unwrap();
    pic.update_call(miner_ids[0], users[0], "set_chunk_size", set_chunk_size_args)
        .expect("Failed to set chunk size for first miner");
    println!("Miner 0 chunk size increased to 10,000 (10x default)");
    
    // Start mining for all miners
    println!("Starting mining for all miners...");
    let mine_args = encode_args(()).unwrap();
    for (i, (miner_id, user)) in miner_ids.iter().zip(users.iter()).enumerate() {
        pic.update_call(*miner_id, *user, "start_mining", mine_args.clone())
            .expect(&format!("Failed to call start_mining for miner {}", i));
        
        if i % 10 == 0 {
            println!("Started mining for {} miners...", i + 1);
        }
    }
    println!("All miners are now mining!");
    
    // Sample miners to track balances through halvings
    // Adjust sample indices based on number of miners
    let sample_indices = if NUM_MINERS <= 5 {
        // If 5 or fewer miners, sample all of them
        (0..NUM_MINERS).collect::<Vec<_>>()
    } else {
        // Otherwise, sample miners at different positions
        let mut indices = Vec::new();
        let step = NUM_MINERS / 5;
        for i in 0..5 {
            indices.push(i * step);
        }
        // Make sure to include the last miner if not already included
        if indices.last() != Some(&(NUM_MINERS - 1)) {
            indices.pop();
            indices.push(NUM_MINERS - 1);
        }
        indices
    };
    
    let mut sample_miners = Vec::new();
    for &idx in &sample_indices {
        sample_miners.push((idx, miner_ids[idx]));
    }
    
    // Track balances at each halving
    let mut balances_by_halving = vec![Vec::new(); TOTAL_HALVINGS as usize + 1]; // Initial + 10 halvings
    
    // Get initial balances for sample miners
    println!("Recording initial balances for sample miners...");
    for &(idx, miner_id) in &sample_miners {
        let balance = get_balance(&pic, token_id, miner_id);
        balances_by_halving[0].push((idx, balance));
        println!("Initial balance for miner {}: {} (formatted: {} TST)", 
                 idx, balance, format_token_amount(balance, TOKEN_DECIMALS));
    }
    
    // Mine until 10 halvings occur
    let mut current_height = 0;
    let mut current_halving = 0;
    
    println!("Starting mining until 10 halvings...");
    while current_halving < TOTAL_HALVINGS {
        // Mine until next halving
        let next_halving_height = (current_halving + 1) * HALVING_INTERVAL;
        println!("Mining toward halving {} at block height {}...", 
                 current_halving + 1, next_halving_height);
        
        while current_height < next_halving_height {
            pic.advance_time(std::time::Duration::from_secs(60)); // simulate block target time
            pic.tick(); // Explicitly trigger heartbeat
            
            // Retrieve the current block height from token to track progress
            let block_template_bytes = pic.query_call(token_id, admin, "get_current_block", encode_args(()).unwrap())
                .expect("Failed to query current block");
            let block_template: Option<BlockTemplate> = Decode!(&block_template_bytes, Option<BlockTemplate>).unwrap();
            
            if let Some(template) = block_template {
                current_height = template.height;
                
                // Print progress every 10 blocks
                if current_height % 10 == 0 {
                    println!("Mining progress: block height {}", current_height);
                }
            }
        }
        
        // Reached a halving point
        current_halving += 1;
        println!("Reached halving {} at block height: {}", current_halving, current_height);
        
        // Mine a few more blocks to ensure rewards are distributed with new rate
        for _ in 0..10 {
            pic.advance_time(std::time::Duration::from_secs(60));
            pic.tick();
        }
        
        // Record balances after this halving
        println!("Recording balances after halving {}...", current_halving);
        for &(idx, miner_id) in &sample_miners {
            let balance = get_balance(&pic, token_id, miner_id);
            balances_by_halving[current_halving as usize].push((idx, balance));
            println!("Miner {} balance after halving {}: {} (formatted: {} TST)", 
                     idx, current_halving, balance, format_token_amount(balance, TOKEN_DECIMALS));
        }
    }
    
    // Calculate and verify rewards after each halving
    println!("\nVerifying mining rewards across halvings:");
    for halving in 0..TOTAL_HALVINGS {
        let expected_reward = (INITIAL_BLOCK_REWARD * 10u64.pow(TOKEN_DECIMALS)) >> halving; // Divide by 2^halving
        println!("\nHalving {}: Expected reward per block: {} (formatted: {} TST)", 
                 halving + 1, expected_reward, format_token_amount(expected_reward, TOKEN_DECIMALS));
        
        // Calculate reward differences between halvings for sample miners
        for i in 0..sample_miners.len() {
            let (idx, _) = sample_miners[i];
            let prev_balance = if halving == 0 { 0 } else { balances_by_halving[halving as usize][i].1 };
            let current_balance = balances_by_halving[(halving + 1) as usize][i].1;
            let reward = current_balance - prev_balance;
            
            println!("Miner {} rewards during halving {}: {} (formatted: {} TST)", 
                     idx, halving + 1, reward, format_token_amount(reward, TOKEN_DECIMALS));
            
            // Verify rewards are non-zero (miners are getting paid)
            if reward == 0 {
                return Err(format!(
                    "Mining rewards for miner {} after halving {} are zero", idx, halving + 1
                ));
            }
        }
    }
    
    println!("\nAll 10 halvings completed successfully with {} miners!", NUM_MINERS);
    
    // At the end, verify the block height has increased
    let block_template_bytes = pic.query_call(token_id, admin, "get_current_block", encode_args(()).unwrap())
        .expect("Failed to query current block");
    let block_template: Option<BlockTemplate> = Decode!(&block_template_bytes, Option<BlockTemplate>).unwrap();
    
    if let Some(template) = block_template {
        println!("Final block height: {}", template.height);
        if template.height <= 0 {
            return Err("Block height did not increase through mining".to_string());
        }
    } else {
        return Err("Could not retrieve current block".to_string());
    }
    
    Ok(())
} 