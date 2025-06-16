use candid::Principal;
use icrc_ledger_types::icrc1::account::Account;

use super::network::ICNetwork;

pub struct KongBackend {}

impl KongBackend {
    /// Principal ID of the canister.
    pub fn canister() -> Principal {
        ic_cdk::api::id()
    }

    /// Account of the canister.
    pub fn canister_id() -> Account {
        Account::from(KongBackend::canister())
    }

    /// Get the canister's Solana address
    pub async fn get_solana_address() -> Result<String, String> {
        ICNetwork::get_solana_address(&KongBackend::canister()).await
    }
}
