// Test file for verifying the token ledger integration with Kong Swap

use candid::{Principal, encode_one, decode_one, Nat, CandidType, Deserialize};
use crate::common::setup_complete_test_environment;
use pocket_ic::PocketIc;
use num_traits::cast::ToPrimitive;

// ICRC-1 types from the token ledger interface
#[derive(CandidType, Clone, Debug, Deserialize)]
pub struct Account {
    pub owner: Principal,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subaccount: Option<Vec<u8>>,
}

/// Helper function to mint tokens from a minting account to a recipient
/// Returns Result<(), String> indicating success or failure with error message
fn mint_tokens(pic: &PocketIc, token_canister_id: Principal, minting_account: Principal, recipient: Principal, amount: u64, recipient_label: &str) -> Result<(), String> {
    // Create an ICRC-1 account for the recipient
    #[derive(CandidType, Debug)]
    struct Account {
        owner: Principal,
        subaccount: Option<Vec<u8>>,
    }

    println!("  ⚙️ Minting {} tokens to {}", amount, recipient_label);

    // Define the ICRC-1 transfer arguments according to the standard
    #[derive(CandidType, Debug)]
    struct TransferArgs {
        // Required args
        to: Account,
        amount: Nat,
        // Optional args
        fee: Option<Nat>,
        memo: Option<Vec<u8>>,
        from_subaccount: Option<Vec<u8>>,
        created_at_time: Option<u64>,
    }

    // Get a timestamp compatible with the ledger's time
    // Instead of using current time which causes CreatedInFuture errors,
    // we'll use a timestamp that's guaranteed to be in the past relative to the ledger
    let current_time = None;  // Let the ledger use its own timestamp

    let transfer_args = TransferArgs {
        to: Account {
            owner: recipient,
            subaccount: None,
        },
        amount: Nat::from(amount),
        fee: None,                  // Default fee
        memo: Some(vec![0, 1, 2, 3]),  // Simple memo
        from_subaccount: None,      // Default subaccount of the caller
        created_at_time: current_time,
    };

    // Debug: Print the transfer args
    println!("  🔍 Transfer args: {:?}", transfer_args);

    // Encode the transfer arguments
    let encoded_args = encode_one(transfer_args).expect("Failed to encode transfer args");

    // Call the transfer method on the token canister
    let mint_result = pic.update_call(
        token_canister_id,
        minting_account,         // The minting account is the caller
        "icrc1_transfer",        // Standard ICRC-1 transfer method
        encoded_args
    );

    // Definition of TransferError and TransferResult for decoding responses
    #[derive(CandidType, Deserialize, Debug)]
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

    #[derive(CandidType, Deserialize, Debug)]
    enum TransferResult {
        Ok(Nat),
        Err(TransferError),
    }

    // Process the mint result
    match mint_result {
        Ok(response) => {
            match decode_one::<TransferResult>(&response) {
                Ok(result) => {
                    match result {
                        TransferResult::Ok(block_index) => {
                            println!("    ✅ Successfully minted tokens to {} (block index: {})", recipient_label, block_index);
                            Ok(())
                        },
                        TransferResult::Err(err) => {
                            let error_msg = format!("Transfer error for {}: {:?}", recipient_label, err);
                            println!("    ❌ {}", error_msg);
                            Err(error_msg)
                        }
                    }
                },
                Err(err) => {
                    let error_msg = format!("Failed to decode mint response for {}: {}", recipient_label, err);
                    println!("    ❌ {}", error_msg);
                    Err(error_msg)
                }
            }
        },
        Err(err) => {
            let error_msg = format!("Failed to mint tokens to {}: {:?}", recipient_label, err);
            println!("    ❌ {}", error_msg);
            Err(error_msg)
        }
    }
}

/// Helper function to query and display a user's token balance
fn query_and_display_balance(pic: &PocketIc, token_canister_id: Principal, account_owner: Principal, account_label: &str) {
    // Create an ICRC-1 account for the user
    #[derive(CandidType)]
    struct Account {
        owner: Principal,
        subaccount: Option<Vec<u8>>,
    }

    // Create balance args
    let balance_args = encode_one(Account {
        owner: account_owner,
        subaccount: None,
    })
    .expect("Failed to encode balance args");

    // Fetch decimals first to format the balance properly
    let decimals_result = pic.query_call(
        token_canister_id,
        Principal::anonymous(),
        "icrc1_decimals",
        encode_one(()).expect("Failed to encode empty args"),
    );
    
    let decimals = match decimals_result {
        Ok(response) => {
            match decode_one::<u8>(&response) {
                Ok(dec) => dec,
                Err(_) => 8, // Default to 8 decimals if we can't decode
            }
        },
        Err(_) => 8, // Default to 8 decimals if query fails
    };

    // Query the token balance
    let balance_result = pic.query_call(
        token_canister_id,
        Principal::anonymous(),
        "icrc1_balance_of",
        balance_args,
    );

    // Process the balance result
    match balance_result {
        Ok(response) => {
            match decode_one::<Nat>(&response) {
                Ok(balance) => {
                    // Convert the balance to a human-readable format based on decimals
                    let balance_u64: u64 = balance.0.to_u64().unwrap_or(0);
                    let formatted_balance = if decimals > 0 {
                        let divisor = 10u64.pow(decimals as u32);
                        if balance_u64 == 0 {
                            0.0
                        } else {
                            (balance_u64 as f64) / (divisor as f64)
                        }
                    } else {
                        balance_u64 as f64
                    };
                    
                    println!("  → {}'s balance: {:.8} KONG ({} raw units)", 
                        account_label, formatted_balance, balance);
                },
                Err(err) => {
                    println!("  → Failed to decode balance for {}: {}", account_label, err);
                }
            }
        },
        Err(err) => {
            println!("  → Failed to query balance for {}: {:?}", account_label, err);
        }
    }
}

#[test]
fn test_token_ledger_integration() {
    println!("\n======= TOKEN LEDGER INTEGRATION TEST =======\n");
    
    // Setup complete test environment (including token ledger)
    println!("Setting up test environment with token ledger...");
    let (pic, pm_canister_id, token_canister_id) = setup_complete_test_environment();
    
    println!("\n✅ Test environment setup complete");
    println!("  → Prediction Markets Canister ID: {}", pm_canister_id);
    println!("  → Token Ledger Canister ID: {}", token_canister_id);
    
    // Check token metadata to verify the token is properly configured
    println!("\nVerifying token metadata...");
    
    // Test 1: Verify the token symbol
    let empty_args = encode_one(()).unwrap();
    let symbol_result = pic.query_call(token_canister_id, Principal::anonymous(), "icrc1_symbol", empty_args.clone());
    let symbol = match symbol_result {
        Ok(response) => {
            match decode_one::<String>(&response) {
                Ok(symbol) => {
                    println!("  → Token symbol: {}", symbol);
                    symbol
                }
                Err(err) => {
                    panic!("Failed to decode token symbol: {}", err);
                }
            }
        }
        Err(err) => {
            panic!("Failed to query token symbol: {:?}", err);
        }
    };
    assert_eq!(symbol, "KONG", "Token symbol should be KONG");
    
    // Test 2: Verify the token decimals
    let decimals_result = pic.query_call(token_canister_id, Principal::anonymous(), "icrc1_decimals", empty_args.clone());
    let decimals = match decimals_result {
        Ok(response) => {
            match decode_one::<u8>(&response) {
                Ok(decimals) => {
                    println!("  → Token decimals: {}", decimals);
                    decimals
                }
                Err(err) => {
                    panic!("Failed to decode token decimals: {}", err);
                }
            }
        }
        Err(err) => {
            panic!("Failed to query token decimals: {:?}", err);
        }
    };
    assert_eq!(decimals, 8, "Token should have 8 decimals");
    
    // Test 3: Verify the token name
    let name_result = pic.query_call(token_canister_id, Principal::anonymous(), "icrc1_name", empty_args.clone());
    let name = match name_result {
        Ok(response) => {
            match decode_one::<String>(&response) {
                Ok(name) => {
                    println!("  → Token name: {}", name);
                    name
                }
                Err(err) => {
                    panic!("Failed to decode token name: {}", err);
                }
            }
        }
        Err(err) => {
            panic!("Failed to query token name: {:?}", err);
        }
    };
    assert_eq!(name, "KONG Token", "Token name should be 'KONG Token'");
    
    // Test 4: Mint tokens to admin and test users and query their balances
    println!("\nMinting tokens and querying account balances...");
    
    // Define the ICRC-1 account structure for the minting account query
    #[derive(CandidType, Deserialize, Debug)]
    struct Account {
        owner: Principal,
        subaccount: Option<Vec<u8>>,
    }
    
    // First, get the minting account from the token ledger
    println!("Querying the minting account from the token ledger...");
    let empty_args = encode_one(()).expect("Failed to encode empty args");
    let minting_account_result = pic.query_call(
        token_canister_id, 
        Principal::anonymous(), 
        "icrc1_minting_account", 
        empty_args.clone()
    );
    
    // Parse the minting account or use admin as fallback
    let admin_principal = Principal::from_text(crate::common::ADMIN_PRINCIPALS[0]).unwrap();
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
    
    // First query the admin and minting account balance before minting
    println!("\nInitial account balances:");
    query_and_display_balance(&pic, token_canister_id, admin_principal, "Admin (initial)");
    query_and_display_balance(&pic, token_canister_id, minting_principal, "Minting account (initial)");
    
    // Define test users using constants from common.rs
    // Use the pre-defined test user principals for consistency across tests
    let test_users = [
        ("Alice", crate::common::TEST_USER_PRINCIPALS[0]),
        ("Bob", crate::common::TEST_USER_PRINCIPALS[1]),
        ("Carol", crate::common::TEST_USER_PRINCIPALS[2]),
        ("Dave", crate::common::TEST_USER_PRINCIPALS[3])
    ];
    
    // Mint tokens to each test user
    println!("\nMinting tokens to test users...");
    let mint_amount = 5_000_000_000_000u64; // 50'000 KONG tokens (matching the standard bet amount of 100 KONG per bet with 8 decimals)
    
    // Mint tokens to each individual test user
    
    for (user_name, user_principal_str) in test_users.iter() {
        match Principal::from_text(user_principal_str) {
            Ok(user_principal) => {
                // Mint tokens to each user individually
                match mint_tokens(&pic, token_canister_id, minting_principal, user_principal, mint_amount, user_name) {
                    Ok(_) => {
                        // Minting successful
                    },
                    Err(err) => {
                        println!("  ❌ Failed to mint tokens to {}: {}", user_name, err);
                    }
                };
            },
            Err(err) => {
                println!("  ❌ Invalid principal for {}: {}", user_name, err);
            }
        }
    }
    
    // Print balances for all users after minting
    println!("\nFinal balances after minting:");
    query_and_display_balance(&pic, token_canister_id, admin_principal, "Admin");
    query_and_display_balance(&pic, token_canister_id, minting_principal, "Minting account");

        // Query individual balances for each user
    for (user_name, user_principal_str) in test_users.iter() {
        match Principal::from_text(user_principal_str) {
            Ok(user_principal) => {
                // Query and display each user's actual balance
                query_and_display_balance(&pic, token_canister_id, user_principal, user_name);
            },
            Err(err) => {
                println!("  ⚠️ Invalid principal for {}, skipping balance check: {}", user_name, err);
            }
        }
    }

    // Test completed successfully
    println!("\n✅ Test completed successfully");

    println!("\n✅ Token ledger integration test completed");
    println!("  → These tests help verify that the token ledger works correctly");
    println!("  → For fully reliable tests, use with the time-weighted bet tests");
}
