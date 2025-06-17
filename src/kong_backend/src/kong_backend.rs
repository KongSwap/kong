use anyhow::Result;
use candid::Principal;
use icrc_ledger_types::icrc1::account::Account;

use crate::ic::management_canister::ManagementCanister;
use crate::solana::network::SolanaNetwork;

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
    pub async fn get_solana_address() -> Result<String> {
        SolanaNetwork::get_public_key(&KongBackend::canister()).await
    }

    pub async fn get_schnorr_public_key(derivation_path: Vec<Vec<u8>>) -> Result<Vec<u8>> {
        ManagementCanister::get_schnorr_public_key(&KongBackend::canister(), derivation_path).await
    }

    pub async fn sign_with_schnorr(data: &[u8]) -> Result<Vec<u8>> {
        ManagementCanister::sign_with_schnorr(&KongBackend::canister(), data).await
    }
}
