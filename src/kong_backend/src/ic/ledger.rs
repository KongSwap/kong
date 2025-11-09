use candid::{Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use kong_lib::ic::ledger::{self as ic_ledger, StandardRecord};

pub async fn get_balance(principal_id: Account, ledger: &Principal) -> Result<Nat, String> {
    ic_ledger::get_balance(ledger, principal_id).await
}

pub async fn get_name(ledger: &Principal) -> Result<String, String> {
    ic_ledger::get_name(ledger).await
}

pub async fn get_symbol(ledger: &Principal) -> Result<String, String> {
    ic_ledger::get_symbol(ledger).await
}

pub async fn get_decimals(ledger: &Principal) -> Result<u8, String> {
    ic_ledger::get_decimals(ledger).await
}

pub async fn get_fee(ledger: &Principal) -> Result<Nat, String> {
    ic_ledger::get_fee(ledger).await
}

/// try icrc10_supported_standards first, if it fails, try icrc1_supported_standards
pub async fn get_supported_standards(ledger: &Principal) -> Result<Vec<StandardRecord>, String> {
    ic_ledger::get_supported_standards(ledger).await
}
