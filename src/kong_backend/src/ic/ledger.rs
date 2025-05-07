use candid::{CandidType, Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct StandardRecord {
    pub url: String,
    pub name: String,
}

pub async fn get_balance(principal_id: Account, ledger: &Principal) -> Result<Nat, String> {
    ic_cdk::call::<(Account,), (Nat,)>(*ledger, "icrc1_balance_of", (principal_id,))
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
