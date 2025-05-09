// Common test utilities for prediction markets backend tests

use candid::{encode_one, decode_one, Principal, Nat};
use serde::{Deserialize, Serialize};
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

/// Test user principals for betting scenarios
pub const TEST_USER_PRINCIPALS: [&str; 4] = [
    // Alice
    "7ioul-dfiqp-fojev-qd5fi-ewhto-twpjf-r37le-gpqli-vmba7-dzhsi-lqe",
    // Bob
    "3rogr-klslx-wr36u-ne33n-7lcs7-dr6xh-cjbbd-oeiok-y6xs4-nl3uq-6qe",
    // Carol
    "mgk4o-6y33o-tmcr5-zwshu-4duy5-v43uo-2mgir-76kmc-tsnmu-3uqrs-kqe",
    // Dave
    "cv577-xkxrm-plvok-h4zqg-hhyeq-umezv-ls7mq-3ct55-ofbdq-bpk77-zae"
];

/// Non-admin principal for testing
pub const NON_ADMIN_PRINCIPAL: &str = "2vxsx-fae";

/// Token constants for testing
pub const KONG_TOKEN_NAME: &str = "kskong_ledger";
pub const KONG_LEDGER_ID: &str = "ryjl3-tyaaa-aaaaa-aaaba-cai"; // Local canister ID
pub const MIN_ACTIVATION_AMOUNT: u64 = 300_000_000_000u64; // 3000 KONG tokens with 8 decimals

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
    
    // Use the same approach as kong_backend for initializing the ICRC-1 token ledger
    // Define the required types for ICRC-1 token ledger initialization
    #[derive(candid::CandidType, Serialize)]
    enum MetadataValue {
        Nat(Nat),
        Int(i64),
        Text(String),
        Blob(Vec<u8>),
    }

    #[derive(candid::CandidType, Serialize)]
    struct FeatureFlags {
        icrc2: bool,
    }

    #[derive(candid::CandidType, Serialize)]
    struct ArchiveOptions {
        num_blocks_to_archive: u64,
        max_transactions_per_response: Option<u64>,
        trigger_threshold: u64,
        max_message_size_bytes: Option<u64>,
        cycles_for_archive_creation: Option<u64>,
        node_max_memory_size_bytes: Option<u64>,
        controller_id: Principal,
        more_controller_ids: Option<Vec<Principal>>,
    }

    #[derive(candid::CandidType, Serialize)]
    struct Account {
        owner: Principal,
        subaccount: Option<Vec<u8>>,
    }

    #[derive(candid::CandidType, Serialize)]
    struct InitArgs {
        minting_account: Account,
        fee_collector_account: Option<Account>,
        transfer_fee: Nat,
        decimals: Option<u8>,
        max_memo_length: Option<u16>,
        token_symbol: String,
        token_name: String,
        metadata: Vec<(String, MetadataValue)>,
        initial_balances: Vec<(Account, Nat)>,
        feature_flags: Option<FeatureFlags>,
        archive_options: ArchiveOptions,
    }

    #[derive(candid::CandidType, Serialize)]
    enum LedgerArg {
        Init(InitArgs),
        Upgrade(Option<()>),
    }

    // Get the admin principal to use as minting account
    let admin_principal = Principal::from_text(ADMIN_PRINCIPALS[0]).unwrap();

    // Create the initialization arguments using the same structure as kong_backend
    let ledger_arg = LedgerArg::Init(InitArgs {
        minting_account: Account {
            owner: admin_principal,
            subaccount: None,
        },
        fee_collector_account: None,
        transfer_fee: Nat::from(10000u64), // 0.0001 KONG with 8 decimals
        decimals: Some(8),
        max_memo_length: Some(32),
        token_symbol: "KONG".to_string(),
        token_name: "KONG Token".to_string(),
        metadata: vec![],
        initial_balances: vec![],
        feature_flags: Some(FeatureFlags { icrc2: true }),
        archive_options: ArchiveOptions {
            num_blocks_to_archive: 1000,
            trigger_threshold: 2000,
            max_transactions_per_response: Some(1000),
            max_message_size_bytes: Some(1024 * 1024),
            cycles_for_archive_creation: Some(100_000_000_000),
            node_max_memory_size_bytes: Some(1024 * 1024 * 1024),
            controller_id: admin_principal,
            more_controller_ids: None,
        },
    });

    // Encode the ledger argument
    let init_args_encoded = encode_one(ledger_arg).unwrap();
    
    println!("Created properly structured token initialization arguments");
    
    pic.install_canister(token_canister_id, token_wasm, init_args_encoded, None);
    println!("✅ Installed KONG token ledger canister with ID: {}", token_canister_id);
    
    // Create and install prediction markets canister
    let pm_canister_id = pic.create_canister();
    pic.add_cycles(pm_canister_id, 2_000_000_000_000); // 2T cycles
    pic.install_canister(pm_canister_id, pm_wasm, vec![], None);
    println!("✅ Installed prediction markets canister with ID: {}", pm_canister_id);
    
    // Prepare to register token with prediction markets canister
    #[derive(candid::CandidType, Serialize)]
    struct TokenInfo {
        id: String,
        is_kong: bool,
        decimals: u8,
        transfer_fee: Nat,
        name: String,
        fee_percentage: u64,
        symbol: String,
    }

    let token_info = TokenInfo {
        id: token_canister_id.to_string(),
        is_kong: true,
        decimals: 8,
        transfer_fee: Nat::from(10000u64),  // 0.0001 KONG
        name: String::from("KONG Token"),
        fee_percentage: 150,   // 1.5% fee
        symbol: String::from("KONG"),
    };

    let register_token_args = encode_one(token_info).expect("Failed to encode token info");
    let admin_principal = Principal::from_text(ADMIN_PRINCIPALS[0]).unwrap();

    // Register token with prediction markets canister
    match pic.update_call(
        pm_canister_id,
        admin_principal, // Caller matters for mutations
        "add_supported_token",  // The correct method name per the Candid definition
        register_token_args,
    ) {
        Ok(_) => println!("✅ Successfully registered token with prediction markets canister"),
        Err(e) => panic!("Failed to register token ledger: {:?}", e),
    };

    // Return both canister IDs
    (pic, pm_canister_id, token_canister_id)
}

/// Mint tokens to test users for testing purposes
/// 
/// This function mints tokens to the specified test users (Alice, Bob, Carol, and Dave)
/// Returns a tuple of (success_count, total_count) indicating how many mint operations were successful
pub fn mint_tokens_to_test_users(
    pic: &PocketIc, 
    token_canister_id: Principal, 
    amount: Option<u64>
) -> (usize, usize) {
    // ICRC-1 account structure - use the same structure as in token initialization
    #[derive(candid::CandidType, Serialize, Deserialize)]
    struct Account {
        owner: Principal,
        subaccount: Option<Vec<u8>>,
    }

    // ICRC-1 transfer arguments structure
    #[derive(candid::CandidType, Serialize)]
    struct TransferArgs {
        to: Account,
        fee: Option<Nat>,
        memo: Option<Vec<u8>>,
        from_subaccount: Option<Vec<u8>>,
        created_at_time: Option<u64>,
        amount: Nat,
    }

    // Standard ICRC-1 transfer error structure
    #[derive(Deserialize, Debug, candid::CandidType)]
    enum TransferError {
        BadFee { expected_fee: Nat },
        BadBurn { min_burn_amount: Nat },
        InsufficientFunds { balance: Nat },
        TooOld,
        CreatedInFuture { ledger_time: u64 },
        Duplicate { duplicate_of: Nat },
        TemporarilyUnavailable,
        GenericError { error_code: Nat, message: String },
    }

    let admin_principal = Principal::from_text(ADMIN_PRINCIPALS[0]).unwrap();
    let default_amount = 50_000_000_000u64; // 500 KONG (with 8 decimals)
    let mint_amount = amount.unwrap_or(default_amount);
    
    // Query minting account from token ledger
    let minting_account_result = pic.query_call(
        token_canister_id,
        Principal::anonymous(),
        "icrc1_minting_account",
        vec![]
    );

    // Default to admin principal if minting account query fails
    let minting_principal = match minting_account_result {
        Ok(response) => {
            match decode_one::<Option<Account>>(&response) {
                Ok(Some(account)) => {
                    println!("  ✓ Found minting account: {}", account.owner);
                    account.owner
                }
                Ok(None) => {
                    println!("  ⚠️ No minting account found, using admin principal");
                    admin_principal
                }
                Err(err) => {
                    println!("  ⚠️ Failed to decode minting account: {}, using admin principal", err);
                    admin_principal
                }
            }
        }
        Err(err) => {
            println!("  ⚠️ Failed to query minting account: {:?}, using admin principal", err);
            admin_principal
        }
    };

    // Track success count
    let mut success_count = 0;
    let total_count = TEST_USER_PRINCIPALS.len();

    // Mint tokens to each test user
    for user_principal_str in TEST_USER_PRINCIPALS.iter() {
        let user_principal = Principal::from_text(user_principal_str).unwrap();
        println!("Minting {} tokens to user {}", mint_amount as f64 / 100_000_000.0, user_principal_str);
        
        // Create transfer arguments for minting tokens
        let transfer_args = TransferArgs {
            to: Account {
                owner: user_principal,
                subaccount: None,
            },
            fee: None,  // No fee for minting operation
            memo: None,
            from_subaccount: None,
            created_at_time: None,
            amount: Nat::from(mint_amount),
        };
        
        // Encode transfer arguments
        let encoded_args = encode_one(transfer_args)
            .expect("Failed to encode transfer arguments");
        
        // Execute transfer (mint) operation
        let mint_result = pic.update_call(
            token_canister_id,
            minting_principal,  // Use the minting account as caller
            "icrc1_transfer",
            encoded_args
        );
        
        match mint_result {
            Ok(response) => {
                // Try to decode the transfer result to see if it was successful
                match decode_one::<Result<Nat, TransferError>>(&response) {
                    Ok(Ok(block_index)) => {
                        println!("  ✅ Successfully minted tokens to {} (block index: {})", user_principal_str, block_index);
                        success_count += 1;
                    },
                    Ok(Err(err)) => {
                        println!("  ❌ Transfer error for {}: {:?}", user_principal_str, err);
                    },
                    Err(err) => {
                        println!("  ❌ Failed to decode transfer response for {}: {}", user_principal_str, err);
                    }
                }
            }
            Err(err) => {
                println!("  ❌ Failed to execute mint operation for {}: {:?}", user_principal_str, err);
            }
        }
    }

    println!("Minted tokens to {}/{} test users", success_count, total_count);
    (success_count, total_count)
}
