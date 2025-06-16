//! This module tests the new claims-based payout system for prediction markets.
//! It creates a market, has users place bets, resolves the market, and then
//! verifies that claims are created correctly and can be processed by users.

use candid::{Nat, Principal, encode_args, decode_one, encode_one};
use num_traits::ToPrimitive;
use pocket_ic::PocketIc;
use std::time::Duration;
use std::thread::sleep;

use crate::common::{setup_complete_test_environment, TEST_USER_PRINCIPALS, ADMIN_PRINCIPALS};
use crate::resolution::resolution_debug::print_binary_data;

// ICRC-1 account structure for token operations
#[derive(candid::CandidType, Debug, Clone)]
struct Account {
    owner: Principal,
    subaccount: Option<Vec<u8>>,
}

// Transfer arguments structure following ICRC-1 standard
#[derive(candid::CandidType, Debug)]
struct TransferArgs {
    from_subaccount: Option<Vec<u8>>,
    to: Account,
    amount: Nat,
    fee: Option<Nat>,
    memo: Option<Vec<u8>>,
    created_at_time: Option<u64>,
}

// Simple structure for a Claim
#[derive(candid::CandidType, Debug, Clone)]
struct ClaimInfo {
    claim_id: u64,
    market_id: Nat,
    claimable_amount: Nat,
    status: String,
    claim_type: String,
}

// Helper function to query an account's token balance
fn query_balance(pic: &PocketIc, token_canister_id: Principal, account_principal: Principal) -> u64 {
    let account = Account {
        owner: account_principal,
        subaccount: None,
    };
    
    let args_bytes = encode_one(account).expect("Failed to encode account");
    
    let balance_result = pic.query_call(
        token_canister_id,
        Principal::anonymous(),
        "icrc1_balance_of",
        args_bytes,
    );
    
    match balance_result {
        Err(err) => {
            println!("Error querying balance: {:?}", err);
            0
        },
        Ok(reply) => {
            let balance: Nat = decode_one(&reply).expect("Failed to decode balance");
            let balance_u64 = balance.0.to_u64().unwrap_or(0);
            balance_u64
        }
    }
}

// Helper function to query and display a user's token balance
fn query_and_display_balance(pic: &PocketIc, token_canister_id: Principal, account_owner: Principal, account_label: &str) -> u64 {
    let balance = query_balance(pic, token_canister_id, account_owner);
    let balance_display = balance as f64 / 100_000_000.0; // 8 decimals for KONG
    println!("  → {}: {} KONG ({} raw units)", account_label, balance_display, balance);
    balance
}

/// Test for claims creation and processing
#[test]
fn test_claims_creation_and_processing() {
    println!("\n======= CLAIMS SYSTEM TEST =======\n");
    
    // ===== SETUP PHASE =====
    // Set up test environment with prediction markets and KONG token canister
    let (pic, pm_canister_id, token_canister_id) = setup_complete_test_environment();
    
    // Get test user principals
    let admin_principal = Principal::from_text(ADMIN_PRINCIPALS[0]).expect("Invalid principal for Admin");
    let alice_principal = Principal::from_text(TEST_USER_PRINCIPALS[0]).expect("Invalid principal for Alice");  // Market creator
    let bob_principal = Principal::from_text(TEST_USER_PRINCIPALS[1]).expect("Invalid principal for Bob");      // First bettor (Yes)
    let carol_principal = Principal::from_text(TEST_USER_PRINCIPALS[2]).expect("Invalid principal for Carol");  // Second bettor (Yes)
    let dave_principal = Principal::from_text(TEST_USER_PRINCIPALS[3]).expect("Invalid principal for Dave");    // Third bettor (No)
    
    // Display initial user balances
    println!("\nInitial Balances:");
    let alice_initial_balance = query_and_display_balance(&pic, token_canister_id, alice_principal, "Alice's");
    let bob_initial_balance = query_and_display_balance(&pic, token_canister_id, bob_principal, "Bob's");
    let carol_initial_balance = query_and_display_balance(&pic, token_canister_id, carol_principal, "Carol's");
    let dave_initial_balance = query_and_display_balance(&pic, token_canister_id, dave_principal, "Dave's");
    
    // Helper function for token transfers
    let transfer_tokens = |from_principal: Principal, amount: u64, label: &str| -> bool {
        println!("  → Transferring {} KONG from {}", amount as f64 / 100_000_000.0, label);
        
        // Set up transfer arguments per ICRC-1 standard
        let transfer_args = TransferArgs {
            from_subaccount: None,
            to: Account {
                owner: pm_canister_id,
                subaccount: None
            },
            amount: Nat::from(amount),
            fee: None,
            memo: None,
            created_at_time: None,
        };
        
        // Encode arguments
        let args_bytes = encode_one(transfer_args).expect("Failed to encode transfer arguments");
        
        // Execute the token transfer
        let transfer_result = pic.update_call(
            token_canister_id,
            from_principal,
            "icrc1_transfer",
            args_bytes,
        );
        
        match transfer_result {
            Err(err) => {
                println!("  ❌ Token transfer failed: {:?}", err);
                false
            },
            Ok(_) => {
                println!("  ✅ Token transfer successful");
                true
            }
        }
    };
    
    // Helper function to place bets and record results
    let place_bet = |principal: Principal, market_id: &Nat, outcome_index: u64, amount: u64, user_label: &str| -> bool {
        println!("  → {} is betting {} KONG on outcome {} ({})", 
            user_label, amount as f64 / 100_000_000.0, outcome_index,
            if outcome_index == 0 { "Yes" } else { "No" });
        
        // First transfer the tokens to the canister
        if !transfer_tokens(principal, amount, user_label) {
            return false;
        }
        
        // Then place the bet
        let bet_args = encode_args((
            market_id.clone(),
            Nat::from(outcome_index), // Must be Nat not u64
            Nat::from(amount),
            None::<String>, // Default token (KONG)
        )).expect("Failed to encode place_bet arguments");
        
        println!("  → Placing bet of {} KONG on outcome {}...", amount as f64 / 100_000_000.0, outcome_index);
        
        // Execute the bet placement
        let bet_result = pic.update_call(
            pm_canister_id,
            principal,
            "place_bet",
            bet_args,
        );
        
        // Check if the bet was successfully placed
        match bet_result {
            Err(err) => {
                println!("  ❌ Bet placement failed: {:?}", err);
                false
            },
            Ok(_) => {
                println!("  ✅ {}'s bet placed successfully", user_label);
                
                // Display new balance
                let new_balance = query_and_display_balance(&pic, token_canister_id, principal, &format!("{}'s", user_label));
                let spent_amount = if user_label == "Alice" {
                    alice_initial_balance - new_balance
                } else if user_label == "Bob" {
                    bob_initial_balance - new_balance
                } else if user_label == "Carol" {
                    carol_initial_balance - new_balance
                } else {
                    dave_initial_balance - new_balance
                };
                println!("  → {} spent {} KONG for {} bet", 
                    user_label, spent_amount as f64 / 100_000_000.0, 
                    if user_label == "Alice" { "activation" } else { "his/her" });
                
                true
            }
        }
    };
    
    // Helper function to query user claims
    let query_user_claims = |principal: Principal, user_label: &str| -> Vec<ClaimInfo> {
        println!("\n=== QUERYING CLAIMS FOR {} ===", user_label);
        
        let claims_args = encode_args((principal,)).expect("Failed to encode get_user_claims arguments");
        
        let claims_result = pic.query_call(
            pm_canister_id,
            principal,
            "get_user_claims",
            claims_args,
        );
        
        match claims_result {
            Err(err) => {
                println!("  ❌ Failed to query claims: {:?}", err);
                Vec::new()
            },
            Ok(raw_claims) => {
                if raw_claims.is_empty() {
                    println!("  ℹ️ No claims found for {}", user_label);
                    Vec::new()
                } else {
                    // Try to decode the claims
                    match decode_one::<Vec<ClaimInfo>>(&raw_claims) {
                        Ok(claims) => {
                            println!("  ✅ Found {} claims for {}", claims.len(), user_label);
                            
                            // Print claim details
                            for (i, claim) in claims.iter().enumerate() {
                                let amount_display = claim.claimable_amount.0.to_u64().unwrap_or(0) as f64 / 100_000_000.0;
                                println!("  → Claim #{}: ID {}, Market {}, Amount: {} KONG, Status: {}, Type: {}", 
                                    i+1, claim.claim_id, claim.market_id, amount_display, claim.status, claim.claim_type);
                            }
                            
                            claims
                        },
                        Err(err) => {
                            println!("  ❌ Failed to decode claims: {:?}", err);
                            println!("  → Raw claims data: {} bytes", raw_claims.len());
                            print_binary_data(&raw_claims, "Claims Data");
                            Vec::new()
                        }
                    }
                }
            }
        }
    };
    
    // Helper function to process a claim
    let process_claim = |principal: Principal, claim_id: u64, user_label: &str| -> bool {
        println!("\n=== PROCESSING CLAIM {} FOR {} ===", claim_id, user_label);
        
        let process_args = encode_args((claim_id,)).expect("Failed to encode process_claim arguments");
        
        let process_result = pic.update_call(
            pm_canister_id,
            principal,
            "process_claim",
            process_args,
        );
        
        match process_result {
            Err(err) => {
                println!("  ❌ Failed to process claim: {:?}", err);
                false
            },
            Ok(_) => {
                println!("  ✅ Successfully processed claim {} for {}", claim_id, user_label);
                true
            }
        }
    };
    
    // ===== MARKET CREATION PHASE =====
    println!("\nTEST 1: Alice creates a market (pending activation)");
    
    // Use a short duration of 120 seconds (2 minutes) for testing
    let market_duration_seconds = 120u64;

    // Create a market
    let create_market_args = encode_args((
        "Will this claims test succeed?".to_string(),  // Question
        vec!["Yes".to_string(), "No".to_string()],     // Outcomes
        Nat::from(market_duration_seconds),           // Duration in seconds
        Nat::from(10_000_000_000u64),                 // Activation amount (100 KONG)
        None::<String>,                               // Default token (KONG)
        true,                                         // Time-weighted payouts
    )).expect("Failed to encode create_market arguments");
    
    let create_result = pic.update_call(
        pm_canister_id,
        alice_principal,
        "create_market",
        create_market_args,
    );
    
    // Check if market creation was successful
    let market_id = match create_result {
        Err(err) => {
            println!("❌ Market creation failed: {:?}", err);
            panic!("Test failed at market creation");
        },
        Ok(reply) => {
            let market_id: Nat = decode_one(&reply).expect("Failed to decode market ID");
            println!("✅ Market created successfully with ID {}", market_id);
            market_id
        }
    };
    
    // ===== BETTING PHASE =====
    println!("\nTEST 2: Users place bets on different outcomes");
    
    // Alice activates the market with 100 KONG
    println!("\n2.1: Alice activates the market");
    place_bet(alice_principal, &market_id, 0, 10_000_000_000u64, "Alice");
    
    // Bob bets 100 KONG on "Yes" (outcome 0)
    println!("\n2.2: Bob bets on YES");
    place_bet(bob_principal, &market_id, 0, 10_000_000_000u64, "Bob");
    
    // Pause to demonstrate time-weighted payouts
    sleep(Duration::from_secs(5));
    
    // Carol also bets 100 KONG on "Yes" (outcome 0) but later
    println!("\n2.3: Carol bets on YES (a bit later)");
    place_bet(carol_principal, &market_id, 0, 10_000_000_000u64, "Carol");
    
    // Dave bets 200 KONG on "No" (outcome 1)
    println!("\n2.4: Dave bets on NO");
    place_bet(dave_principal, &market_id, 1, 20_000_000_000u64, "Dave");
    
    // Record balances after betting
    println!("\nBalances after betting phase:");
    let alice_after_bet = query_and_display_balance(&pic, token_canister_id, alice_principal, "Alice's");
    let bob_after_bet = query_and_display_balance(&pic, token_canister_id, bob_principal, "Bob's");
    let carol_after_bet = query_and_display_balance(&pic, token_canister_id, carol_principal, "Carol's");
    let dave_after_bet = query_and_display_balance(&pic, token_canister_id, dave_principal, "Dave's");
    let canister_balance_after_bets = query_and_display_balance(&pic, token_canister_id, pm_canister_id, "Prediction Market Canister's");
    
    // ===== MARKET RESOLUTION PHASE =====
    println!("\nTEST 3: Wait for market duration and resolve market");
    
    // Wait for the market duration to complete
    println!("  → Waiting for {} seconds for market to be ready for resolution...", market_duration_seconds);
    
    // Fast-forward the IC time
    pic.advance_time(Duration::from_secs(market_duration_seconds + 5));
    
    // Admin resolves the market with "Yes" winning (outcome 0)
    println!("\n3.1: Admin resolves the market with 'Yes' as the winning outcome");
    
    let resolve_args = encode_args((
        market_id.clone(),
        vec![Nat::from(0u64)],  // Yes wins (outcome index 0)
    )).expect("Failed to encode resolve_market arguments");
    
    let resolve_result = pic.update_call(
        pm_canister_id,
        admin_principal,
        "resolve_market",
        resolve_args,
    );
    
    match resolve_result {
        Err(err) => {
            println!("❌ Market resolution failed: {:?}", err);
            panic!("Test failed at market resolution");
        },
        Ok(_) => {
            println!("✅ Market resolved successfully");
        }
    }
    
    // ===== CLAIMS QUERY PHASE =====
    println!("\nTEST 4: Check for claims created during market resolution");
    
    // Query claims for each user
    let alice_claims = query_user_claims(alice_principal, "Alice");
    let bob_claims = query_user_claims(bob_principal, "Bob");
    let carol_claims = query_user_claims(carol_principal, "Carol");
    let dave_claims = query_user_claims(dave_principal, "Dave");
    
    // Verify claims were created correctly
    assert!(!bob_claims.is_empty(), "Bob should have a winning claim");
    assert!(!carol_claims.is_empty(), "Carol should have a winning claim");
    assert!(dave_claims.is_empty(), "Dave should not have a claim (losing bet)");
    
    if !bob_claims.is_empty() && !carol_claims.is_empty() {
        // Time-weighted payout should give Bob a higher payout than Carol
        let bob_amount = bob_claims[0].claimable_amount.0.to_u64().unwrap_or(0);
        let carol_amount = carol_claims[0].claimable_amount.0.to_u64().unwrap_or(0);
        
        println!("\nClaim amount comparison (time-weighted effect):");
        println!("  → Bob's claim amount: {} KONG", bob_amount as f64 / 100_000_000.0);
        println!("  → Carol's claim amount: {} KONG", carol_amount as f64 / 100_000_000.0);
        
        // Bob bet earlier so should get more
        assert!(bob_amount > carol_amount, "Bob should have a higher payout than Carol due to time-weighting");
        println!("✅ Time-weighted claims correctly gave Bob (earliest bettor) a higher claim amount than Carol");
    }
    
    // ===== CLAIM PROCESSING PHASE =====
    println!("\nTEST 5: Users process their claims to receive payouts");
    
    // Bob processes his claim
    if !bob_claims.is_empty() {
        process_claim(bob_principal, bob_claims[0].claim_id, "Bob");
    }
    
    // Carol processes her claim
    if !carol_claims.is_empty() {
        process_claim(carol_principal, carol_claims[0].claim_id, "Carol");
    }
    
    // ===== FINAL BALANCE CHECK =====
    println!("\nTEST 6: Check final balances after claim processing");
    
    // Check final balances
    let bob_final = query_and_display_balance(&pic, token_canister_id, bob_principal, "Bob's");
    let carol_final = query_and_display_balance(&pic, token_canister_id, carol_principal, "Carol's");
    let dave_final = query_and_display_balance(&pic, token_canister_id, dave_principal, "Dave's");
    let canister_final = query_and_display_balance(&pic, token_canister_id, pm_canister_id, "Prediction Market Canister's");
    
    // Verify balances after claims processing
    assert!(bob_final > bob_after_bet, "Bob should have received tokens from his winning claim");
    assert!(carol_final > carol_after_bet, "Carol should have received tokens from her winning claim");
    assert_eq!(dave_final, dave_after_bet, "Dave's balance should remain unchanged (losing bet)");
    
    // The canister balance should decrease after payouts
    assert!(canister_final < canister_balance_after_bets, "Canister balance should decrease after claim payouts");
    
    // ===== Checks for time-weighted distribution =====
    // Verify that Bob got more than Carol due to placing his bet earlier
    assert!(bob_final - bob_after_bet > carol_final - carol_after_bet, 
        "Bob should receive more from his claim than Carol due to time-weighting");
    
    // Both winners should at least get their original bet back
    assert!(bob_final >= bob_initial_balance, "Bob should get at least his original balance back");
    assert!(carol_final >= carol_initial_balance, "Carol should get at least her original balance back");
    
    println!("\n======= CLAIMS SYSTEM TEST COMPLETED SUCCESSFULLY =======");
}
