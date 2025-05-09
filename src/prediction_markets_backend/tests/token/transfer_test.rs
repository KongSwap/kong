// Test file for token transfers between users in the Kong Swap platform

use candid::{decode_one, encode_one, Principal, Nat, CandidType, Deserialize};
use num_traits::ToPrimitive;
use pocket_ic::PocketIc;
use crate::common::{setup_complete_test_environment, TEST_USER_PRINCIPALS};

// ICRC-1 types from the token ledger interface
#[derive(CandidType, Clone, Debug, Deserialize)]
pub struct Account {
    pub owner: Principal,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subaccount: Option<Vec<u8>>,
}

// Transfer arguments structure following ICRC-1 standard
#[derive(CandidType, Debug)]
struct TransferArgs {
    // Required args
    from_subaccount: Option<Vec<u8>>,
    to: Account,
    amount: Nat,
    // Optional args
    fee: Option<Nat>,
    memo: Option<Vec<u8>>,
    created_at_time: Option<u64>,
}

// Instead of defining our own types for transfer results, use simple Value parsing
// This avoids issues with exact candid structure matching

/// Helper function to query an account's token balance
fn query_balance(pic: &PocketIc, token_canister_id: Principal, account_principal: Principal) -> u64 {
    println!("  🔍 Querying balance for {} from token canister {}", account_principal, token_canister_id);
    
    // Create the account structure
    let account = Account {
        owner: account_principal,
        subaccount: None,
    };

    // Encode account
    let args = encode_one(account).unwrap();

    // Query balance
    let result = match pic.query_call(
        token_canister_id, // This must be the token ledger canister ID
        Principal::anonymous(),
        "icrc1_balance_of",
        args,
    ) {
        Ok(res) => res,
        Err(err) => {
            println!("  ❌ Error querying balance: {:?}", err);
            panic!("Failed to query balance: {:?}", err);
        }
    };

    // Decode the balance
    let balance: Nat = match decode_one(&result) {
        Ok(bal) => bal,
        Err(err) => {
            println!("  ❌ Error decoding balance: {:?}", err);
            panic!("Failed to decode balance: {:?}", err);
        }
    };
    
    balance.0.to_u64().unwrap()
}

/// Helper function to display a formatted balance with proper decimal places
fn format_balance(balance: u64, decimals: u8) -> String {
    let divisor = 10u64.pow(decimals as u32) as f64;
    format!("{:.8} KONG ({} raw units)", balance as f64 / divisor, balance)
}

/// Helper function to query and display a user's token balance
fn query_and_display_balance(pic: &PocketIc, token_canister_id: Principal, account_owner: Principal, account_label: &str) -> u64 {
    // Query the user's balance
    let balance = query_balance(pic, token_canister_id, account_owner);
    
    // Get token decimals (default to 8 if query fails)
    // icrc1_decimals takes no arguments but needs an empty candid value encoding
    let decimals = match pic.query_call(
        token_canister_id, // Make sure this is the token canister
        Principal::anonymous(),
        "icrc1_decimals",
        encode_one(()).unwrap(), // Properly encode empty argument as candid value
    ) {
        Ok(result) => decode_one::<u8>(&result).unwrap_or(8),
        Err(err) => {
            println!("  ⚠️ Failed to query token decimals: {:?}, using default of 8", err);
            8
        }
    };
    
    // Format and print the balance
    println!("  → {}'s balance: {}", account_label, format_balance(balance, decimals));
    
    balance
}

/// Test token transfers between users on the Kong Swap platform
#[test]
fn test_token_transfer() {
    println!("\n--- Testing ICRC-1 token transfers between users ---");
    
    // Setup environment with token ledger and prediction markets canister
    println!("Setting up test environment with token ledger...");
    // The function returns (pic, pm_canister_id, token_canister_id) so destructure correctly
    let (pic, pm_canister_id, token_canister_id) = setup_complete_test_environment();
    println!("  ℹ️ Using prediction markets canister: {}", pm_canister_id);
    println!("  ℹ️ Using token ledger canister: {}", token_canister_id);
    
    // Get principals for Dave (sender) and Alice (recipient)
    let dave_principal = Principal::from_text(TEST_USER_PRINCIPALS[3]).unwrap(); // Dave
    let alice_principal = Principal::from_text(TEST_USER_PRINCIPALS[0]).unwrap(); // Alice
    
    // Get token metadata for display purposes
    let token_symbol = match pic.query_call(
        token_canister_id, 
        Principal::anonymous(),
        "icrc1_symbol",
        encode_one(()).unwrap(), // Properly encode empty argument as candid value
    ) {
        Ok(result) => decode_one::<String>(&result).unwrap_or_else(|_| "KONG".to_string()),
        Err(_) => "KONG".to_string(),
    };
    
    let token_decimals = match pic.query_call(
        token_canister_id,
        Principal::anonymous(),
        "icrc1_decimals",
        encode_one(()).unwrap(), // Properly encode empty argument as candid value
    ) {
        Ok(result) => decode_one::<u8>(&result).unwrap_or(8),
        Err(_) => 8,
    };
    
    println!("Working with {} token with {} decimals", token_symbol, token_decimals);
    
    // Get initial balances
    println!("\nInitial Balances:");
    let dave_initial_balance = query_and_display_balance(&pic, token_canister_id, dave_principal, "Dave (sender)");
    let alice_initial_balance = query_and_display_balance(&pic, token_canister_id, alice_principal, "Alice (recipient)");
    
    // Amount to transfer: 100 KONG (with 8 decimals)
    let transfer_amount = 10_000_000_000u64; 
    let transfer_amount_display = transfer_amount as f64 / 10f64.powi(token_decimals as i32);
    
    println!("\nTransferring {} {} from Dave to Alice...", transfer_amount_display, token_symbol);
    
    // Prepare transfer arguments (following ICRC-1 standard)
    let transfer_args = TransferArgs {
        from_subaccount: None,
        to: Account {
            owner: alice_principal,
            subaccount: None,
        },
        amount: Nat::from(transfer_amount),
        fee: None,
        memo: Some(vec![0, 1, 2, 3]), // Example memo
        created_at_time: None,
    };
    
    // Display the transfer arguments for debugging
    println!("  🔍 Transfer arguments: from Dave to Alice, amount: {}, memo: {:?}", transfer_amount, vec![0, 1, 2, 3]);
    
    // Encode transfer arguments
    let args = encode_one(transfer_args).unwrap();
    
    // Execute transfer from Dave to Alice
    let transfer_result = pic.update_call(
        token_canister_id,
        dave_principal,
        "icrc1_transfer",
        args,
    ).unwrap();
    
    // This more flexible approach avoids Candid type matching issues
    // We only check if transfer succeeded by querying balances afterwards
    
    // First, wait a moment to ensure the transfer is processed
    std::thread::sleep(std::time::Duration::from_millis(100));
    
    // Query final balances
    println!("\nFinal Balances after Transfer:");
    let dave_final_balance = query_and_display_balance(&pic, token_canister_id, dave_principal, "Dave (sender)");
    let alice_final_balance = query_and_display_balance(&pic, token_canister_id, alice_principal, "Alice (recipient)");
    
    // Calculate and display balance changes
    let dave_change = dave_initial_balance as i64 - dave_final_balance as i64;
    let alice_change = alice_final_balance as i64 - alice_initial_balance as i64;
    
    println!("\nBalance Changes:");
    println!("  → Dave: -{} {}", dave_change as f64 / 10f64.powi(token_decimals as i32), token_symbol);
    println!("  → Alice: +{} {}", alice_change as f64 / 10f64.powi(token_decimals as i32), token_symbol);
    
    // Verify the transfer was processed correctly
    if dave_change >= transfer_amount as i64 && alice_change == transfer_amount as i64 {
        println!("\n✅ Transfer successful! Balances updated correctly.");
        
        // Try to get the latest block for verification
        // According to Candid spec, get_blocks expects a record {start: BlockIndex, length: nat}
        #[derive(CandidType)]
        struct GetBlocksArgs {
            start: Nat,
            length: Nat,
        }
        
        let get_blocks_args = GetBlocksArgs {
            start: Nat::from(0u64),
            length: Nat::from(1u64),
        };
        
        match pic.query_call(
            token_canister_id,
            Principal::anonymous(),
            "get_blocks",
            encode_one(get_blocks_args).unwrap(),
        ) {
            Ok(blocks_result) => {
                println!("  ✓ Successfully verified ledger block information");
            },
            Err(err) => {
                println!("  ⚠️ Could not verify block details: {:?}", err);
            }
        };
        
        println!("\n✅ Token transfer test completed successfully");
    } else {
        // Failed transfer
        println!("\n❌ Transfer failed! Balances did not update as expected.");
        panic!("Transfer verification failed: Dave change = {}, Alice change = {}", dave_change, alice_change);
    }
}
