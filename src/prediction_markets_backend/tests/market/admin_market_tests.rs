use candid::{encode_one, decode_one, Principal, Nat};
use crate::common::{setup_prediction_markets_canister, ADMIN_PRINCIPALS};

/// This test validates that an admin can create a market
/// It focuses on verifying admin functionality without introducing custom types
/// that would need to implement CandidType and Deserialize traits
#[test]
fn test_admin_market_creation_simple() {
    println!("\n======= ADMIN MARKET CREATION SIMPLE TEST =======\n");
    
    // Setup the canister
    let (pic, canister_id) = setup_prediction_markets_canister();
    println!("Testing with canister ID: {}\n", canister_id);
    
    // Choose an admin principal to test with
    let admin_principal_str = ADMIN_PRINCIPALS[0];
    let admin_principal = Principal::from_text(admin_principal_str)
        .expect(&format!("Invalid admin principal: {}", admin_principal_str));
    
    println!("TEST 1: Creating market as admin principal: {}", admin_principal_str);
    
    // Market parameters 
    // These will be encoded directly without type checking, relying on canister's type checks
    let question = "Will BTC reach $100K by end of 2025?".to_string();
    let category = 0; // 0 = Crypto in the backend enum
    let rules = "Market resolves YES if BTC price reaches $100,000 on any major exchange before Dec 31, 2025".to_string();
    let outcomes = vec!["Yes".to_string(), "No".to_string()];
    let resolution_method = 0; // 0 = Categorical in the backend enum
    let end_time_duration = Nat::from(3600u64); // 1 hour duration
    
    // Encode the market creation arguments directly with primitive types
    let args = encode_one((
        question.clone(),
        category,
        rules.clone(),
        outcomes.clone(),
        resolution_method,
        (0, end_time_duration), // 0 = Duration variant in the backend enum
        Option::<String>::None, // No image URL
        Option::<bool>::None,   // Default time weighting
        Option::<f64>::None,    // Default alpha
        Option::<String>::None, // Default token
    )).unwrap();
    
    // Call create_market as admin
    let result = pic.update_call(
        canister_id,
        admin_principal, // Called with admin principal
        "create_market",
        args,
    );
    
    // Check result - we don't decode to custom type, just check success
    match result {
        Ok(reply) => {
            // We don't decode to MarketId, just confirm we got a successful response
            println!("✅ Market created successfully!");
            println!("Received reply of {} bytes", reply.len());
            
            // Verify admin recognition
            println!("\nTEST 2: Verifying admin recognition");
            let is_admin_args = encode_one(admin_principal).unwrap();
            let admin_result = pic.query_call(
                canister_id,
                Principal::anonymous(), // Caller doesn't matter for this check
                "is_admin",
                is_admin_args,
            );
            
            match admin_result {
                Ok(admin_reply) => {
                    let is_admin: bool = decode_one(&admin_reply).unwrap();
                    println!("Admin check result: {} (Expected: true)", is_admin);
                    assert!(is_admin, "Admin principal not recognized as admin");
                    println!("✅ Admin principal recognition confirmed");
                },
                Err(err) => {
                    println!("❌ ERROR: Admin check failed: {:?}", err);
                    panic!("Admin check failed: {:?}", err);
                }
            }
            
            println!("\n======= ADMIN MARKET CREATION TEST PASSED =======\n");
            println!("Summary:\n- Market creation by admin: PASSED\n- Admin recognition confirmation: PASSED");
        },
        Err(err) => {
            println!("❌ ERROR: Market creation failed: {:?}", err);
            panic!("Market creation failed: {:?}", err);
        }
    }
}
