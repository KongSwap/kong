use candid::{Nat, Principal};
use futures::join;
use ic_cdk::update;
use icrc_ledger_types::icrc1::account::Account;
use kong_lib::ic::get_time::get_time;
use kong_lib::ic::id::caller_id;
use kong_lib::ic::logging::error_log;

use crate::ic::constants::{CKBTC, CKBTC_LEDGER, CKETH, CKETH_LEDGER, CKUSDT, CKUSDT_LEDGER, ICP, ICP_LEDGER, KONG, KONG_LEDGER};
use crate::ic::transfer::icrc1_transfer;
use crate::stable_user::user_map::{get_user, update_user_token_claim};

const ICP_CLAIM_AMOUNT: u128 = 1_000_000_000; // 10 ICP
const CKUSDT_CLAIM_AMOUNT: u128 = 100_000_000; // 100 ckUSDT
const CKBTC_CLAIM_AMOUNT: u128 = 200_000; // 0.002 ckBTC
const CKETH_CLAIM_AMOUNT: u128 = 50_000_000_000_000_000; // 0.05 ckETH
const KONG_CLAIM_AMOUNT: u128 = 100_000_000_000; // 1000 KONG

#[update]
pub async fn claim() -> Result<String, String> {
    let icp_claim_amount: Nat = Nat::from(ICP_CLAIM_AMOUNT);
    let icp_ledger = Principal::from_text(ICP_LEDGER).unwrap();
    let ckusdt_claim_amount: Nat = Nat::from(CKUSDT_CLAIM_AMOUNT);
    let ckusdt_ledger = Principal::from_text(CKUSDT_LEDGER).unwrap();
    let ckbtc_claim_amount: Nat = Nat::from(CKBTC_CLAIM_AMOUNT);
    let ckbtc_ledger = Principal::from_text(CKBTC_LEDGER).unwrap();
    let cketh_claim_amount: Nat = Nat::from(CKETH_CLAIM_AMOUNT);
    let cketh_ledger = Principal::from_text(CKETH_LEDGER).unwrap();
    let kong_ledger = Principal::from_text(KONG_LEDGER).unwrap();
    let kong_claim_amount: Nat = Nat::from(KONG_CLAIM_AMOUNT);

    let user = get_user().await?;
    let now = get_time();

    // 24 hours = 86,400,000,000,000 nanoseconds
    if now - user.last_claimed_at < 86_400_000_000_000 {
        Err("You have already claimed tokens in the last 24 hours.".to_string())?;
    }

    let caller_id = caller_id();
    match join!(
        transfer_token(ICP, &icp_claim_amount, &caller_id, &icp_ledger),
        transfer_token(CKUSDT, &ckusdt_claim_amount, &caller_id, &ckusdt_ledger),
        transfer_token(CKBTC, &ckbtc_claim_amount, &caller_id, &ckbtc_ledger),
        transfer_token(CKETH, &cketh_claim_amount, &caller_id, &cketh_ledger),
        transfer_token(KONG, &kong_claim_amount, &caller_id, &kong_ledger),
    ) {
        (Ok(_), Ok(_), Ok(_), Ok(_), Ok(_)) => {
            update_user_token_claim()?;
            Ok("Tokens successfully claimed! Please wait 24 hours before claiming more.".to_string())
        }
        _ => Err("Failed to claim tokens".to_string())?,
    }
}

async fn transfer_token(symbol: &str, amount: &Nat, to_address: &Account, ledger: &Principal) -> Result<(), String> {
    _ = icrc1_transfer(amount, to_address, ledger)
        .await
        .map_err(|e| log_transfer_error(symbol, e.as_str()))?;
    Ok(())
}

pub fn log_transfer_error(token: &str, e: &str) -> String {
    let error = format!("{} claim failed: {}", token, e);
    error_log(&error);
    error
}
