//! Standalone test module focused only on demonstrating the debugging utilities
//! This file is designed to be independent of the main resolution_test.rs
//! to avoid syntax errors

use crate::common::{setup_complete_test_environment, TEST_USER_PRINCIPALS, ADMIN_PRINCIPALS};
use crate::resolution::resolution_debug::{print_binary_data, analyze_market_status, analyze_payout_records, analyze_user_history};
use candid::{Nat, Principal, encode_args, decode_one};
use pocket_ic::PocketIc;
use std::time::Duration;

/// Creates a simple market, places bets, and demonstrates the debugging utilities
#[test]
fn test_market_resolution_debugging() {
    println!("\n======= STANDALONE MARKET RESOLUTION DEBUGGING TEST =======\n");
    
    // Set up test environment
    let (mut pic, pm_canister_id, token_canister_id) = setup_complete_test_environment();
    
    // Use principals from test configuration
    let admin_principal = ADMIN_PRINCIPALS[0];
    let alice_principal = TEST_USER_PRINCIPALS[0]; // User who creates the market
    let bob_principal = TEST_USER_PRINCIPALS[1];   // User who bets on outcome 0 (Yes)
    let carol_principal = TEST_USER_PRINCIPALS[2]; // User who bets on outcome 0 (Yes) 
    let dave_principal = TEST_USER_PRINCIPALS[3];  // User who bets on outcome 1 (No)
    
    println!("TEST SCENARIO: Creating a simple binary market with time-weighted payouts");
    println!("1. Admin creates a market");
    println!("2. Multiple users place bets");
    println!("3. The market is resolved");
    println!("4. We analyze various responses with our debugging utilities");
    
    // STEP 1: Create market (using admin for simplicity)
    println!("\n>> STEP 1: Creating market via admin");
    
    // Create a simple binary market
    let market_title = "Will debugging utilities help improve market resolution?".to_string();
    let market_description = "Market to test time-weighted payouts and debugging".to_string();
    let closing_timestamp = ic_cdk::api::time() + 120_000_000_000; // 2 minutes from now
    let category = 2u8; // Arbitrary category
    let resolution_method = 1u8;  // Admin resolution
    let outcomes = vec!["Yes".to_string(), "No".to_string()];
    
    // Specify token for the market (use KONG token)
    let token_symbol = "KONG".to_string();
    let token_address = token_canister_id.to_text();
    let token_decimals = 8u8;
    
    // Build the market creation arguments
    let create_market_args = encode_args((
        market_title, 
        market_description, 
        Nat::from(closing_timestamp), 
        category,
        resolution_method,
        outcomes, 
        token_symbol, 
        token_address, 
        token_decimals,
        // Time-weighted = true (enable time-weighted payouts)
        true,
    )).unwrap();
    
    // Create the market
    let create_result = pic.update_call(
        pm_canister_id,
        admin_principal,
        "create_market",
        create_market_args,
    );
    
    let market_id = match create_result {
        Ok(bytes) => {
            match decode_one::<Nat>(&bytes) {
                Ok(id) => {
                    println!("  ✅ Market created successfully with ID: {}", id);
                    id
                },
                Err(_) => {
                    println!("  ⚠️ Failed to decode market ID");
                    Nat::from(0u64)
                }
            }
        },
        Err(err) => {
            println!("  ⚠️ Failed to create market: {}", err);
            Nat::from(0u64)
        }
    };
    
    // If market wasn't created, we can't continue
    if market_id == Nat::from(0u64) {
        println!("  ⚠️ Cannot continue test without a valid market ID");
        return;
    }
    
    // STEP 2: Place bets from multiple users
    println!("\n>> STEP 2: Multiple users placing bets");
    
    // Function to place a bet
    let place_bet = |user: Principal, outcome_index: u8, amount: u64| {
        let bet_args = encode_args((
            market_id.clone(),
            outcome_index,
            Nat::from(amount)
        )).unwrap();
        
        let bet_result = pic.update_call(
            pm_canister_id,
            user,
            "place_bet",
            bet_args,
        );
        
        match bet_result {
            Ok(_) => println!("  ✅ User {} bet {} on outcome {}", user, amount, outcome_index),
            Err(err) => println!("  ⚠️ User {} failed to bet: {}", user, err),
        }
    };
    
    // Place bets with different users
    place_bet(bob_principal, 0, 100_000_000); // Bob bets 1 KONG on Yes
    
    // Wait 5 seconds before Carol's bet to show time-weighting
    pic.advance_time(Duration::from_secs(5));
    place_bet(carol_principal, 0, 200_000_000); // Carol bets 2 KONG on Yes
    
    // Wait 5 seconds before Dave's bet
    pic.advance_time(Duration::from_secs(5));
    place_bet(dave_principal, 1, 300_000_000); // Dave bets 3 KONG on No
    
    // STEP 3: Resolve the market
    println!("\n>> STEP 3: Resolving the market");
    
    // First, we need to advance time past the closing timestamp
    pic.advance_time(Duration::from_secs(120));
    
    // Resolve the market with outcome 0 (Yes)
    let resolve_args = encode_args((
        market_id.clone(),
        vec![0u8], // Outcome 0 (Yes) wins
    )).unwrap();
    
    let resolve_result = pic.update_call(
        pm_canister_id,
        admin_principal,
        "resolve_via_admin",
        resolve_args,
    );
    
    match resolve_result {
        Ok(_) => println!("  ✅ Market successfully resolved with outcome 0 (Yes)"),
        Err(err) => println!("  ⚠️ Failed to resolve market: {}", err),
    }
    
    // STEP 4: Use debugging utilities to analyze responses
    println!("\n>> STEP 4: Using debugging utilities to analyze responses");
    
    // 4.1: Query and analyze market status
    println!("\n>> MARKET STATUS ANALYSIS:");
    let market_args = encode_args((market_id.clone(),)).unwrap();
    let market_result = pic.query_call(
        pm_canister_id,
        alice_principal,
        "get_market",
        market_args,
    );
    
    match market_result {
        Ok(market_bytes) => {
            analyze_market_status(&market_bytes);
        },
        Err(err) => {
            println!("  ⚠️ Could not query market: {}", err);
        }
    }
    
    // 4.2: Query and analyze payout records
    println!("\n>> PAYOUT RECORDS ANALYSIS:");
    let market_id_u64 = market_id.0.to_u64().unwrap();
    let payout_args = encode_args((market_id_u64,)).unwrap();
    let payout_records_result = pic.query_call(
        pm_canister_id,
        alice_principal,
        "get_market_payout_records",
        payout_args,
    );
    
    match payout_records_result {
        Ok(raw_records) => {
            analyze_payout_records(&raw_records);
        },
        Err(err) => {
            println!("  ⚠️ Could not retrieve payout records: {}", err);
        }
    }
    
    // 4.3: Query and analyze Bob's user history (he bet on the winning outcome)
    println!("\n>> BOB'S USER HISTORY ANALYSIS (bet on winning outcome):");
    let bob_history_args = encode_args((bob_principal,)).unwrap();
    let bob_history_result = pic.query_call(
        pm_canister_id,
        bob_principal,
        "get_user_history",
        bob_history_args,
    );
    
    match bob_history_result {
        Ok(history_bytes) => {
            analyze_user_history(&history_bytes, "Bob", &market_id.to_string());
        },
        Err(err) => {
            println!("  ⚠️ Could not retrieve Bob's history: {}", err);
        }
    }
    
    // 4.4: Query and analyze Dave's user history (he bet on the losing outcome)
    println!("\n>> DAVE'S USER HISTORY ANALYSIS (bet on losing outcome):");
    let dave_history_args = encode_args((dave_principal,)).unwrap();
    let dave_history_result = pic.query_call(
        pm_canister_id,
        dave_principal,
        "get_user_history",
        dave_history_args,
    );
    
    match dave_history_result {
        Ok(history_bytes) => {
            analyze_user_history(&history_bytes, "Dave", &market_id.to_string());
        },
        Err(err) => {
            println!("  ⚠️ Could not retrieve Dave's history: {}", err);
        }
    }
    
    println!("\n======= END OF MARKET RESOLUTION DEBUGGING TEST =======\n");
}
