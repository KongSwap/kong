use candid::Principal;
use icrc_ledger_types::icrc1::account::Account;

pub struct KongData {}

impl KongData {
    /// Principal ID of the canister.
    pub fn canister() -> Principal {
        ic_cdk::api::id()
    }

    /// Account of the canister.
    pub fn canister_id() -> Account {
        Account::from(KongData::canister())
    }
}
