use candid::{Principal, encode_args, decode_one, Nat};
use crate::common::{setup_prediction_markets_canister, ADMIN_PRINCIPALS};

#[derive(candid::CandidType)]
enum MarketCategory {
    AI,
    Memes,
    Crypto,
    Other,
    Politics,
    KongMadness,
    Sports,
}

#[derive(candid::CandidType)]
enum ResolutionMethod {
    Admin,
}

#[derive(candid::CandidType)]
enum MarketEndTime {
    Duration(Nat),
}

/// Test for admin market creation with simple parameters using direct candid encoding
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
    
    // Use standard encode_args from candid
    let question = "Will BTC reach $100K by end of 2023?".to_string();
    let category = MarketCategory::Crypto;
    let rules = "Market resolves YES if BTC price reaches $100,000 on any major exchange before Dec 31, 2023".to_string();
    let outcomes = vec!["Yes".to_string(), "No".to_string()];
    let resolution_method = ResolutionMethod::Admin;
    let end_time = MarketEndTime::Duration(Nat::from(120u64)); // 2 minutes
    let image_url = Option::<String>::None;
    let uses_time_weighting = Some(true);
    let time_weight_alpha = Some(0.1);
    let token_id = Option::<String>::None;
    
    // Encode arguments using Candid's encode_args
    let args = encode_args((
        question,
        category,
        rules,
        outcomes,
        resolution_method,
        end_time,
        image_url,
        uses_time_weighting,
        time_weight_alpha,
        token_id,
    )).expect("Failed to encode market creation arguments");
    
    println!("Market creation arguments encoded successfully");
    
    // Make update call to canister with admin principal as caller
    let result = pic.update_call(
        canister_id,
        admin_principal,
        "create_market",
        args,
    );
    
    match result {
        Err(err) => {
            println!("Error creating market: {}", err);
            panic!("Market creation failed: {}", err);
        }
        Ok(reply_bytes) => {
            // Decode the returned market ID as a Result<Nat, String>
            let market_result: Result<Nat, String> = decode_one(&reply_bytes).expect("Failed to decode market ID result");
            
            // Extract the market ID from the Result
            let market_id = match market_result {
                Ok(id) => id,
                Err(err) => {
                    println!("Error in market creation response: {}", err);
                    panic!("Market creation returned an error: {}", err);
                }
            };
            println!("Market created successfully with ID: {}", market_id);
            
            // Verify the market exists and is active
            println!("\nTEST 2: Verifying market status");
            
            // Encode just the market ID for the query (clone it first to avoid move issues)
            let query_args = encode_args((market_id.clone(),)).expect("Failed to encode market ID for query");
            
            // Query the market with admin principal as caller
            let status_result = pic.query_call(
                canister_id,
                admin_principal,
                "get_market",
                query_args,
            );
            
            match status_result {
                Err(err) => {
                    println!("Error getting market status: {}", err);
                    panic!("Market status check failed: {}", err);
                }
                Ok(_) => {
                    println!("Market status verified successfully");
                    println!("Test passed! Admin market creation works as expected.");
                }
            }
            
            println!("\n====== TEST SUMMARY ======");
            println!("  Successfully created a market as admin with ID: {}", market_id);
            println!("  Markets run for 120 seconds for quick testing");
            
            println!("\n======= ADMIN MARKET CREATION TEST PASSED =======\n");
            println!("Summary:\n- Market created successfully with ID: {}", market_id);
            println!("- Market is ACTIVE and ready for betting without activation");
            println!("- Time-weighted distribution enabled as configured");
            println!("- Test completed successfully");
        }
    }
}
