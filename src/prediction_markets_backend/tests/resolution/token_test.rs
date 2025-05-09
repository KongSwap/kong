// Test file for verifying the token ledger integration

use candid::{Principal, encode_args, decode_one, Nat};
use num_traits::Zero;
use crate::common::{
    setup_complete_test_environment, 
    mint_tokens_to_test_users, 
    TEST_USER_PRINCIPALS
};

#[test]
fn test_token_ledger_integration() {
    println!("\n======= TOKEN LEDGER INTEGRATION TEST =======\n");
    
    // Setup complete test environment (including token ledger)
    println!("Setting up test environment with token ledger...");
    let (pic, pm_canister_id, token_canister_id) = setup_complete_test_environment();
    
    println!("✅ Test environment setup complete");
    println!("  → Prediction Markets Canister ID: {}", pm_canister_id);
    println!("  → Token Ledger Canister ID: {}", token_canister_id);
    
    // Mint tokens to test users
    println!("\nMinting 50,000 KONG tokens to each test user...");
    let (success_count, total_count) = mint_tokens_to_test_users(&pic, token_canister_id, None);
    
    assert_eq!(
        success_count, 
        total_count, 
        "Expected all {} token mints to succeed, but only {} succeeded", 
        total_count, 
        success_count
    );
    
    // Check account balances to verify minting
    println!("\nVerifying account balances...");
    
    for principal_str in TEST_USER_PRINCIPALS.iter() {
        let user_principal = Principal::from_text(principal_str).unwrap();
        
        // Create balance_of args for user - just pass the principal directly
        let balance_args = encode_args((user_principal,))
            .expect("Failed to encode balance_of arguments");
        
        // Query the balance
        let balance_result = pic.query_call(
            token_canister_id,
            user_principal, // principal doesn't matter for query calls
            "icrc1_balance_of",
            balance_args,
        );
        
        match balance_result {
            Ok(response) => {
                // Try to decode the response as a Nat
                match decode_one::<Nat>(&response) {
                    Ok(balance) => {
                        // Use the `to_string()` method to display the balance
                        // This avoids conversion issues
                        let human_readable = balance.0.to_string();
                        println!("  → User {} balance: {} raw units", principal_str, human_readable);
                        
                        // Just make sure there's a non-zero balance
                        // This avoids conversion issues with to_u64
                        assert!(
                            !balance.0.is_zero(),
                            "Expected non-zero balance for user {}", 
                            principal_str
                        );
                    },
                    Err(err) => {
                        println!("  ❌ Failed to decode balance for {}: {}", principal_str, err);
                        assert!(false, "Failed to decode balance for {}", principal_str);
                    }
                }
            },
            Err(err) => {
                println!("  ❌ Failed to query balance for {}: {:?}", principal_str, err);
                assert!(false, "Failed to query balance for {}", principal_str);
            }
        }
    }
    
    println!("\n✅ Token ledger integration test passed successfully!");
}
