//! Test methods for the Kong backend canister.
//! These methods are only available in non-production builds.

use candid::{Nat, Principal};
use ic_cdk::api::management_canister::main::{canister_status, CanisterIdRecord};
use ic_cdk_macros::*;

use crate::ic::get_time::get_time;
use crate::ic::verify::{verify_transfer, verify_transfer_icrc3, verify_transfer_get_transactions};
use crate::stable_token::ic_token::ICToken;
use crate::stable_token::stable_token::StableToken;

/// Test method for the verify_transfer function.
/// This is the main verification function that attempts all verification methods.
#[update]
async fn test_verify_transfer(token_id: Principal, block_id: Nat, amount: Nat) -> Result<(), String> {
    // Create a test token with ICRC3 support
    let token = StableToken::IC(ICToken {
        token_id: 999,
        name: "Test Token".to_string(),
        symbol: "TEST".to_string(),
        canister_id: token_id,
        decimals: 8,
        fee: Nat::from(10000u64),
        icrc1: true,
        icrc2: true,
        icrc3: true,
        is_removed: false,
    });
    
    // Call the main verify_transfer method which will try all verification methods
    verify_transfer(&token, &block_id, &amount).await
}
/// Test method for the verify_transfer_icrc3 function.
/// This specifically tests the ICRC3 get_blocks verification method.
#[update]
async fn test_verify_icrc3_transfer(token_id: Principal, block_id: Nat, amount: Nat) -> Result<(), String> {
    // Create a test token with ICRC3 support
    let token = StableToken::IC(ICToken {
        token_id: 999,
        name: "Test Token".to_string(),
        symbol: "TEST".to_string(),
        canister_id: token_id,
        decimals: 8,
        fee: Nat::from(10000u64),
        icrc1: true,
        icrc2: true,
        icrc3: true,
        is_removed: false,
    });
    
    // Set timestamp starting point (recent enough to not cause expiry)
    let ts_start = get_time() - 1_000_000_000; // 1 second ago
    
    // Call the ICRC3 get_blocks verification method directly
    verify_transfer_icrc3(&token, &block_id, &amount, ts_start).await
}

/// Test method for the verify_transfer_get_transactions function.
/// This specifically tests the ICRC3 get_transactions verification method.
#[update]
async fn test_verify_get_transactions(token_id: Principal, block_id: Nat, amount: Nat) -> Result<(), String> {
    // Create a test token with ICRC3 support
    let token = StableToken::IC(ICToken {
        token_id: 999,
        name: "Test Token".to_string(),
        symbol: "TEST".to_string(),
        canister_id: token_id,
        decimals: 8, 
        fee: Nat::from(10000u64),
        icrc1: true,
        icrc2: true,
        icrc3: true,
        is_removed: false,
    });
    
    // Set timestamp starting point (recent enough to not cause expiry)
    let ts_start = get_time() - 1_000_000_000; // 1 second ago
    
    // Call the ICRC3 get_transactions verification method directly
    verify_transfer_get_transactions(&token, &block_id, &amount, ts_start).await
}

/// Test method for the canister status.
#[update]
async fn test_canister_status(canister_id: Principal) -> String {
    match canister_status(CanisterIdRecord {
        canister_id,
    })
    .await
    {
        Ok((status,)) => format!("{:?}", status),
        Err((code, msg)) => format!("Error {:?}: {}", code, msg),
    }
}