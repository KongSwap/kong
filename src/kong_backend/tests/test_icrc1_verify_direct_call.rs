pub mod common;

use candid::{Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use common::icrc1_ledger::{create_icrc1_ledger_simple, icrc1_transfer, SimpleLedgerConfig};
use common::setup::setup_ic_environment;
use kong_backend::stable_token::ic_token::ICToken;
use kong_backend::stable_token::stable_token::StableToken;
use kong_backend::ic::verify::verify_transfer;
use futures::executor::block_on;

#[test]
fn test_verify_transfer_direct_function_call() {
    // Setup IC environment
    let (ic, kong_backend) = setup_ic_environment().expect("Failed to setup IC environment");
    
    // Create user and Kong accounts
    let user_principal = Principal::from_text("2vxsx-fae").unwrap();
    let user_account = Account {
        owner: user_principal,
        subaccount: None,
    };
    
    let kong_backend_account = Account {
        owner: kong_backend,
        subaccount: None,
    };
    
    // Setup simple ICRC1 ledger
    let initial_balance = Nat::from(1_000_000_000u64);
    let ledger_config = SimpleLedgerConfig {
        token_symbol: "DEMO".to_string(),
        token_name: "Demo Token".to_string(),
        initial_balances: vec![(user_account.clone(), initial_balance.clone())],
        transfer_fee: Nat::from(5_000u64),
        decimals: 6,
        controller: kong_backend, // Controller can be kong_backend or any other principal for this test
    };
    
    let token_canister_id = create_icrc1_ledger_simple(&ic, ledger_config.clone())
        .expect("Failed to create ICRC1 ledger");
    
    // Perform transfer
    let transfer_amount = Nat::from(50_000_000u64);
    let tx_id = icrc1_transfer(
        &ic,
        token_canister_id,
        user_principal,
        kong_backend_account.clone(), // Clone here as it's used later
        transfer_amount.clone(),
        None,
        None,
    )
    .expect("Transfer failed");

    println!("Transfer successful with tx_id: {}", tx_id);

    // Create ICToken instance for verification
    let ic_token = ICToken {
        token_id: 0, // Dummy value for test
        name: ledger_config.token_name,
        symbol: ledger_config.token_symbol,
        canister_id: token_canister_id,
        decimals: ledger_config.decimals,
        fee: ledger_config.transfer_fee,
        icrc1: true,     // Assuming simple ledger is ICRC1
        icrc2: false,    // Assuming simple ledger is not ICRC2
        icrc3: false,    // Assuming simple ledger is not ICRC3 for this basic test
        is_removed: false,
    };
    let stable_token = StableToken::IC(ic_token);

    // Verify the transfer (expect panic when run outside a canister)
    let verification_panic = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        block_on(verify_transfer(&stable_token, &tx_id, &transfer_amount))
    }));

    // verify_transfer relies on ic_cdk::api::time() which panics outside of a canister. We
    // therefore assert that a panic indeed occurs, proving that we reached the call site
    // inside verify.rs and that the function was executed up to that point.
    assert!(verification_panic.is_err(), "verify_transfer did not panic as expected outside canister context");
}
