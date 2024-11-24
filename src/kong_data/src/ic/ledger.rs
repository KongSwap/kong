use candid::{CandidType, Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};

use crate::stable_kong_settings::kong_settings;

use super::id::caller_id;

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct StandardRecord {
    pub url: String,
    pub name: String,
}

pub async fn get_backend_canister_balance(ledger: &Principal) -> Result<Nat, String> {
    ic_cdk::call::<(Account,), (Nat,)>(
        *ledger,
        "icrc1_balance_of",
        (kong_settings::get().kong_backend_account,),
    )
    .await
    .map(|(balance,)| balance)
    .map_err(|e| e.1)
}

#[allow(dead_code)]
pub async fn get_user_balance(ledger: &Principal) -> Result<Nat, String> {
    ic_cdk::call::<(Account,), (Nat,)>(*ledger, "icrc1_balance_of", (caller_id(),))
        .await
        .map(|(balance,)| balance)
        .map_err(|e| e.1)
}

pub async fn get_name(ledger: &Principal) -> Result<String, String> {
    ic_cdk::call::<(), (String,)>(*ledger, "icrc1_name", ())
        .await
        .map(|(name,)| name)
        .map_err(|e| e.1)
}

pub async fn get_symbol(ledger: &Principal) -> Result<String, String> {
    ic_cdk::call::<(), (String,)>(*ledger, "icrc1_symbol", ())
        .await
        .map(|(symbol,)| symbol)
        .map_err(|e| e.1)
}

pub async fn get_decimals(ledger: &Principal) -> Result<u8, String> {
    ic_cdk::call::<(), (u8,)>(*ledger, "icrc1_decimals", ())
        .await
        .map(|(decimals,)| decimals)
        .map_err(|e| e.1)
}

pub async fn get_fee(ledger: &Principal) -> Result<Nat, String> {
    ic_cdk::call::<(), (Nat,)>(*ledger, "icrc1_fee", ())
        .await
        .map(|(fee,)| fee)
        .map_err(|e| e.1)
}

/// try icrc10_supported_standards first, if it fails, try icrc1_supported_standards
pub async fn get_supported_standards(ledger: &Principal) -> Result<Vec<StandardRecord>, String> {
    match ic_cdk::call::<(), (Vec<StandardRecord>,)>(*ledger, "icrc10_supported_standards", ())
        .await
        .map(|(standards,)| standards)
    {
        Ok(standards) => Ok(standards),
        Err(_) => ic_cdk::call::<(), (Vec<StandardRecord>,)>(*ledger, "icrc1_supported_standards", ())
            .await
            .map(|(standards,)| standards)
            .map_err(|e| e.1),
    }
}

#[allow(dead_code)]
pub async fn get_total_supply(ledger: &Principal) -> Result<Nat, String> {
    ic_cdk::call::<(), (Nat,)>(*ledger, "icrc1_total_supply", ())
        .await
        .map(|(supply,)| supply)
        .map_err(|e| e.1)
}
