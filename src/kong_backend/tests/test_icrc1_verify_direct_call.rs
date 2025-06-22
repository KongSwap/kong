// TODO:
// - fix verify_transfer assertion

pub mod common;

use candid::{Nat, Principal};
use common::icrc1_ledger::{create_icrc1_ledger_simple, icrc1_transfer, SimpleLedgerConfig};
use common::setup::setup_ic_environment;
use icrc_ledger_types::icrc1::account::Account;

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

    let token_canister_id = create_icrc1_ledger_simple(&ic, ledger_config.clone()).expect("Failed to create ICRC1 ledger");

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

    // TODO fix
    // verify_transfer assertion
}
