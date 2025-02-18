use candid::{Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;

pub async fn get_balance(principal_id: Account, ledger: &Principal) -> Result<Nat, String> {
    ic_cdk::call::<(Account,), (Nat,)>(*ledger, "icrc1_balance_of", (principal_id,))
        .await
        .map(|(balance,)| balance)
        .map_err(|e| e.1)
}

pub async fn get_fee(ledger: &Principal) -> Result<Nat, String> {
    ic_cdk::call::<(), (Nat,)>(*ledger, "icrc1_fee", ())
        .await
        .map(|(fee,)| fee)
        .map_err(|e| e.1)
}
