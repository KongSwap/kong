use candid::Principal;

use crate::solana::network::SolanaNetwork;

pub struct ICNetwork {}

impl ICNetwork {
    /// Get the canister's Solana address
    pub async fn get_solana_address(canister: &Principal) -> Result<String, String> {
        SolanaNetwork::get_public_key(canister).await.map_err(|e| e.to_string())
    }
}
