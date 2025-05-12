// Common test utilities for prediction markets backend tests

use candid::{encode_one, Principal};
use pocket_ic::PocketIc;
use std::path::PathBuf;
use std::fs::File;
use std::io::Read;
use flate2::read::GzDecoder;

/// List of admin principals from the implementation
pub const ADMIN_PRINCIPALS: [&str; 7] = [
    "4jxje-hbmra-4otqc-6hor3-cpwlh-sqymk-6h4ef-42sqn-o3ip5-s3mxk-uae",
    "6rjil-isfbu-gsmpe-ffvcl-v3ifl-xqgkr-en2ir-pbr54-cetku-syp4i-bae",
    "hkxzv-wmenl-q4d3b-j3o5s-yucpn-g5itu-b3zmq-hxggl-s3atg-vryjf-dqe",
    // Shill principals below
    "7ohni-sbpse-y327l-syhzk-jn6n4-hw277-erei5-xhkjr-lbh6b-rjqei-sqe",
    "6ydau-gqejl-yqbq7-tm2i5-wscbd-lsaxy-oaetm-dxddd-s5rtd-yrpq2-eae",
    "bc4tr-kdoww-zstxb-plqge-bo6ho-abuc2-mft22-6tdpb-5ofll-yknor-sae",
    // Aaron
    "m6wjp-mi46v-ekfrp-lu3wo-ero7s-e2y57-yu4kv-235o5-bnmti-qjpgk-aqe"
];

/// Non-admin principal for testing
pub const NON_ADMIN_PRINCIPAL: &str = "2vxsx-fae";

/// Token constants for testing
pub const KONG_TOKEN_NAME: &str = "kskong_ledger";
pub const KONG_LEDGER_ID: &str = "ryjl3-tyaaa-aaaaa-aaaba-cai"; // Local canister ID
pub const MIN_ACTIVATION_AMOUNT: u64 = 2500_0000_0000u64; // 25 KONG tokens with 8 decimals

/// Helper function to get the Wasm path for the prediction_markets_backend canister
pub fn get_wasm_path() -> PathBuf {
    // Start from the manifest directory, but we need to go up to the "kong" directory
    let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    // Go up one directory from src/prediction_markets_backend to the kong directory
    path.pop(); // Remove "prediction_markets_backend"
    path.pop(); // Remove "src"
    
    // Now add the path to the Wasm file
    path.push(".dfx");
    path.push("local");
    path.push("canisters");
    path.push("prediction_markets_backend");
    path.push("prediction_markets_backend.wasm");
    
    println!("Looking for prediction markets Wasm file at: {:?}", path);
    
    if !path.exists() {
        panic!("Prediction markets Wasm file not found at {:?}. Make sure to build the canister first with 'dfx build prediction_markets_backend'.", path);
    }
    
    path
}

/// Helper function to get the Wasm path for the KONG token ledger canister
pub fn get_token_wasm_path() -> PathBuf {
    // Start from the manifest directory, but we need to go up to the "kong" directory
    let mut path = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    // Go up one directory from src/prediction_markets_backend to the kong directory
    path.pop(); // Remove "prediction_markets_backend"
    path.pop(); // Remove "src"
    
    // Now add the path to the Wasm file
    path.push(".dfx");
    path.push("local");
    path.push("canisters");
    path.push("kskong_ledger");
    path.push("kskong_ledger.wasm.gz");
    
    println!("Looking for KONG token Wasm file at: {:?}", path);
    
    if !path.exists() {
        panic!("KONG token Wasm file not found at {:?}. Make sure to build the canister first with 'dfx build kskong_ledger'.", path);
    }
    
    path
}

/// Read and decompress a gzipped Wasm file
pub fn read_gz_wasm(path: PathBuf) -> Vec<u8> {
    let file = File::open(&path).expect(&format!("Failed to open file: {:?}", &path));
    let mut decoder = GzDecoder::new(file);
    let mut wasm = Vec::new();
    decoder.read_to_end(&mut wasm).expect("Failed to decompress Wasm file");
    wasm
}

/// Setup a test environment with prediction markets backend and KONG token canisters
pub fn setup_prediction_markets_canister() -> (PocketIc, Principal) {
    // Initialize PocketIC
    let pic = PocketIc::new();
    
    // Get the Wasm modules from the build directory
    let pm_wasm_path = get_wasm_path();
    let pm_wasm = std::fs::read(pm_wasm_path).expect("Failed to read prediction markets Wasm file");
    
    // Create canister for prediction markets backend
    let canister_id = pic.create_canister();
    pic.add_cycles(canister_id, 2_000_000_000_000); // 2T cycles
    pic.install_canister(canister_id, pm_wasm, vec![], None);
    
    // In PocketIC tests for now, we'll skip setting up the token canister
    // But we'll note this in the test output for clarity
    println!("NOTE: In PocketIC test environment, token transfers are simulated");
    println!("In a real environment, token canister setup and approvals would be required");
    
    (pic, canister_id)
}

/// Setup a complete test environment with token ledger for tests that need token transfers
pub fn setup_complete_test_environment() -> (PocketIc, Principal, Principal) {
    // Initialize PocketIC
    let pic = PocketIc::new();
    
    // Get the prediction markets Wasm
    let pm_wasm_path = get_wasm_path();
    let pm_wasm = std::fs::read(pm_wasm_path).expect("Failed to read prediction markets Wasm file");
    
    // Try to load the token ledger Wasm (gzipped)
    let token_wasm_path = get_token_wasm_path();
    let token_wasm = match read_gz_wasm(token_wasm_path) {
        wasm => {
            println!("✅ Successfully loaded KONG token Wasm");
            wasm
        }
    };
    
    // Create and install token ledger canister (with predefined ID)
    let token_id = Principal::from_text(KONG_LEDGER_ID).expect("Invalid token canister ID");
    
    // Note: For simplicity in tests, we'll use regular create_canister instead of create_canister_with_id
    // which requires more setup in PocketIC
    let token_canister_id = pic.create_canister();
    pic.add_cycles(token_canister_id, 2_000_000_000_000); // 2T cycles
    
    println!("Created token canister with ID: {} (instead of {})", token_canister_id, token_id);
    
    // Initialize token ledger with default accounts
    let init_args = encode_one((  // Simplified init args for testing
        "KONG Token",            // token_name
        "KONG",                 // token_symbol
        8u8,                    // decimals
        1_000_000_000_000u64,   // total_supply
        Principal::from_text(ADMIN_PRINCIPALS[0]).unwrap(), // minting_account
    )).unwrap();
    
    pic.install_canister(token_canister_id, token_wasm, init_args, None);
    println!("✅ Installed KONG token ledger canister with ID: {}", token_canister_id);
    
    // Create and install prediction markets canister
    let pm_canister_id = pic.create_canister();
    pic.add_cycles(pm_canister_id, 2_000_000_000_000); // 2T cycles
    pic.install_canister(pm_canister_id, pm_wasm, vec![], None);
    println!("✅ Installed prediction markets canister with ID: {}", pm_canister_id);
    
    // Return both canister IDs
    (pic, pm_canister_id, token_canister_id)
}
