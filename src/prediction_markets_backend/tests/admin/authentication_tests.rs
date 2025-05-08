use candid::{decode_one, encode_one, Principal};
use crate::common::{setup_prediction_markets_canister, ADMIN_PRINCIPALS, NON_ADMIN_PRINCIPAL};

#[test]
fn test_admin_authentication() {
    // Setup the canister
    let (pic, canister_id) = setup_prediction_markets_canister();
    println!("\n======= ADMIN AUTHENTICATION TEST DETAILS =======\n");
    println!("Testing with canister ID: {}\n", canister_id);
    
    // Test the canister's own ID is admin
    println!("TEST 1: Checking if canister's own ID is recognized as admin...");
    let result = pic.query_call(
        canister_id,
        canister_id, // Called with canister's own ID
        "is_admin",
        encode_one(canister_id).unwrap(),
    );
    
    match result {
        Ok(reply) => {
            let is_admin: bool = decode_one(&reply).unwrap();
            println!("Result: {} (Expected: true)", is_admin);
            assert!(is_admin, "Canister's own ID should be an admin");
            println!("✅ Canister self-identification as admin: PASSED\n");
        }
        Err(err) => {
            println!("❌ ERROR: Call rejected: {:?}", err);
            panic!("Call rejected: {:?}", err);
        }
    };
    
    // Test all predefined admin principals
    println!("TEST 2: Checking all {} predefined admin principals...", ADMIN_PRINCIPALS.len());
    for (i, admin_principal_str) in ADMIN_PRINCIPALS.iter().enumerate() {
        println!("  {} - Testing admin principal: {}", i+1, admin_principal_str);
        let admin_principal = Principal::from_text(admin_principal_str)
            .expect(&format!("Invalid admin principal: {}", admin_principal_str));
        
        let result = pic.query_call(
            canister_id,
            Principal::anonymous(), // Caller doesn't matter for this test
            "is_admin",
            encode_one(admin_principal).unwrap(),
        );
        
        match result {
            Ok(reply) => {
                let is_admin: bool = decode_one(&reply).unwrap();
                println!("  Result: {} (Expected: true)", is_admin);
                assert!(is_admin, "Admin principal {} should be recognized as admin", admin_principal_str);
                println!("  ✅ Admin principal recognized: PASSED");
            }
            Err(err) => {
                println!("  ❌ ERROR: Call rejected for admin {}: {:?}", admin_principal_str, err);
                panic!("Call rejected for admin {}: {:?}", admin_principal_str, err);
            }
        };
    }
    println!("");
    
    // Test a non-admin principal
    println!("TEST 3: Checking that non-admin principal '{}' is rejected...", NON_ADMIN_PRINCIPAL);
    let non_admin_principal = Principal::from_text(NON_ADMIN_PRINCIPAL)
        .expect("Invalid non-admin principal");
    
    let result = pic.query_call(
        canister_id,
        Principal::anonymous(), // Caller doesn't matter for this test
        "is_admin",
        encode_one(non_admin_principal).unwrap(),
    );
    
    match result {
        Ok(reply) => {
            let is_admin: bool = decode_one(&reply).unwrap();
            println!("Result: {} (Expected: false)", is_admin);
            assert!(!is_admin, "Non-admin principal should not be recognized as admin");
            println!("✅ Non-admin principal rejection: PASSED\n");
        }
        Err(err) => {
            println!("❌ ERROR: Call rejected for non-admin test: {:?}", err);
            panic!("Call rejected for non-admin test: {:?}", err);
        }
    };
    
    println!("======= ALL ADMIN AUTHENTICATION TESTS PASSED =======\n");
    println!("Summary:\n- Canister self-identification: PASSED\n- {} Admin principals recognition: PASSED\n- Non-admin principal rejection: PASSED", ADMIN_PRINCIPALS.len());
}
