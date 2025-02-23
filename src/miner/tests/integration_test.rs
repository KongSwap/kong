use candid::{Principal, encode_args};
use pocket_ic::{PocketIc, WasmResult};
use std::{fs, sync::Once, path::PathBuf, env};
use serde;

static INIT: Once = Once::new();

fn initialize() {
    INIT.call_once(|| {
        // Set environment variable to ignore version mismatch
        env::set_var("POCKET_IC_IGNORE_VERSION", "1");
        
        // Only check if wasm files exist
        let manifest_dir = env::var("CARGO_MANIFEST_DIR")
            .expect("Failed to get CARGO_MANIFEST_DIR");
        let path_buf = PathBuf::from(manifest_dir);
        let workspace_root = path_buf
            .parent()
            .and_then(|p| p.parent())
            .expect("Failed to find workspace root");
            
        let wasm_path = workspace_root.join("src/launchpad_backend/wasm/miner_wasm/miner.wasm");
        if !wasm_path.exists() {
            panic!("Wasm file not found at {}. Please run ./scripts/get_lastest_wasms.sh first", wasm_path.display());
        }
    });
}

// Helper function to load Wasm modules
fn load_wasm(path: &str) -> Vec<u8> {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR")
        .expect("Failed to get CARGO_MANIFEST_DIR");
    let path_buf = PathBuf::from(manifest_dir);
    let workspace_root = path_buf
        .parent()
        .and_then(|p| p.parent())
        .expect("Failed to find workspace root");
        
    let wasm_path = workspace_root.join(path);
    fs::read(&wasm_path)
        .unwrap_or_else(|e| panic!("Failed to load wasm from {}: {}", wasm_path.display(), e))
}

// Helper function to get token info
fn get_token_info(pic: &PocketIc, token_id: Principal) -> TokenInfo {
    let info_result = pic.query_call(
        token_id,
        Principal::anonymous(),
        "get_info",
        encode_args(()).expect("Failed to encode empty args")
    ).expect("Failed to query token info");
    
    match info_result {
        WasmResult::Reply(bytes) => {
            let info: Result<TokenInfo, String> = candid::decode_one(&bytes)
                .expect("Failed to decode token info");
            info.expect("Failed to get token info")
        },
        WasmResult::Reject(msg) => panic!("Failed to get token info: {}", msg),
    }
}

#[test]
fn test_miner_basic_functionality() {
    initialize();
    
    // Initialize PocketIC
    let pic = PocketIc::new();
    
    // 1. First create a token backend (we need this to test mining against)
    let token_id = pic.create_canister();
    pic.add_cycles(token_id, 200_000_000_000_000u128); // Add 200T cycles
    
    let token_wasm = load_wasm("src/launchpad_backend/wasm/token_backend_wasm/token_backend.wasm");
    let token_args = encode_args((TokenInitArgs {
        name: "Test Token".to_string(),
        ticker: "TEST".to_string(),
        total_supply: 1_000_000u64,
    },)).expect("Failed to encode token init args");
    
    pic.install_canister(token_id, token_wasm, token_args, None);
    
    // Start the token (creates ICRC ledger)
    let start_result = pic.update_call(
        token_id,
        Principal::from_text("2vxsx-fae").unwrap(), // Creator
        "start_token",
        encode_args(()).expect("Failed to encode empty args")
    ).expect("Failed to call start_token");
    
    assert!(matches!(start_result, WasmResult::Reply(_)));
    
    // Wait for token info to show ledger is initialized
    let token_info = get_token_info(&pic, token_id);
    assert!(token_info.ledger_id.is_some(), "Token ledger should be initialized");
    let ledger_id = token_info.ledger_id.unwrap();
    println!("Token ledger initialized: {}", ledger_id);
    
    // 2. Create a miner independently
    let miner_id = pic.create_canister();
    pic.add_cycles(miner_id, 100_000_000_000_000u128); // Add 100T cycles
    
    let miner_wasm = load_wasm("src/launchpad_backend/wasm/miner_wasm/miner.wasm");
    let owner = Principal::from_text("2vxsx-fae").unwrap();
    let miner_args = encode_args((MinerInitArgs {
        owner,
        token_backend: token_id,
    },)).expect("Failed to encode miner init args");
    
    pic.install_canister(miner_id, miner_wasm, miner_args, None);
    
    // 3. Test miner operations
    
    // Connect to token
    let connect_result = pic.update_call(
        miner_id,
        owner,
        "connect_token",
        encode_args((token_id,)).expect("Failed to encode connect args")
    ).expect("Failed to call connect_token");
    
    assert!(matches!(connect_result, WasmResult::Reply(_)));
    
    // Start mining
    let start_mining_result = pic.update_call(
        miner_id,
        owner,
        "start_mining",
        encode_args(()).expect("Failed to encode empty args")
    ).expect("Failed to call start_mining");
    
    assert!(matches!(start_mining_result, WasmResult::Reply(_)));
    
    // Try finding multiple solutions
    let mut solutions_found = 0;
    let target_solutions = 3;
    let mut last_solution = 0u64;
    
    while solutions_found < target_solutions {
        // Get current target number from token backend for debugging
        let target_result = pic.query_call(
            token_id,
            owner,
            "get_target",
            encode_args(()).expect("Failed to encode empty args")
        ).expect("Failed to query target");
        
        let current_target = match target_result {
            WasmResult::Reply(bytes) => {
                let target: Result<u64, String> = candid::decode_one(&bytes)
                    .expect("Failed to decode target");
                target.expect("Failed to get target")
            },
            WasmResult::Reject(msg) => panic!("Failed to get target: {}", msg),
        };
        
        println!("Current target number: {}", current_target);
        
        // Try numbers 1-10 for each round
        let mut found_in_round = false;
        
        for i in 1..=10u64 {
            let result = pic.update_call(
                miner_id,
                owner,
                "submit_solution",
                encode_args((i,)).expect("Failed to encode solution")
            );
            
            match result {
                Ok(WasmResult::Reply(bytes)) => {
                    // Decode the inner Result<(), String>
                    let inner_result: Result<(), String> = candid::decode_one(&bytes)
                        .expect("Failed to decode response");
                        
                    match inner_result {
                        Ok(()) => {
                            solutions_found += 1;
                            println!("Found solution {}: {} (target was {})", solutions_found, i, current_target);
                            
                            // Verify this solution matches the target
                            assert_eq!(i, current_target, "Solution {} doesn't match target {}", i, current_target);
                            
                            // Verify this solution is different from the last one
                            assert_ne!(i, last_solution, "Got same solution twice in a row: {}", i);
                            last_solution = i;
                            found_in_round = true;
                            break;
                        },
                        Err(e) => {
                            println!("Solution {} rejected: {} (target is {})", i, e, current_target);
                            continue;
                        }
                    }
                },
                Ok(WasmResult::Reject(msg)) => {
                    println!("Solution {} rejected: {} (target is {})", i, msg, current_target);
                    continue;
                },
                Err(e) => {
                    panic!("Error submitting solution: {:?}", e);
                }
            }
        }
        
        // Verify we found a solution in this round
        assert!(found_in_round, "Failed to find solution in round {} (target was {})", solutions_found + 1, current_target);
        
        // Add a small delay between solutions to ensure random seed changes
        std::thread::sleep(std::time::Duration::from_millis(100));
    }
    
    // Verify we found all target solutions
    assert_eq!(solutions_found, target_solutions, "Should find exactly {} solutions", target_solutions);
    
    // Stop mining
    let stop_mining_result = pic.update_call(
        miner_id,
        owner,
        "stop_mining",
        encode_args(()).expect("Failed to encode empty args")
    ).expect("Failed to call stop_mining");
    
    assert!(matches!(stop_mining_result, WasmResult::Reply(_)));
    
    // Disconnect from token
    let disconnect_result = pic.update_call(
        miner_id,
        owner,
        "disconnect_token",
        encode_args(()).expect("Failed to encode empty args")
    ).expect("Failed to call disconnect_token");
    
    assert!(matches!(disconnect_result, WasmResult::Reply(_)));
}

// Import necessary structs
#[derive(candid::CandidType)]
struct TokenInitArgs {
    name: String,
    ticker: String,
    total_supply: u64,
}

#[derive(candid::CandidType, serde::Deserialize)]
struct MinerInitArgs {
    owner: Principal,
    token_backend: Principal,
}

#[derive(candid::CandidType, serde::Deserialize)]
struct TokenInfo {
    name: String,
    ticker: String,
    total_supply: u64,
    ledger_id: Option<Principal>,
} 
