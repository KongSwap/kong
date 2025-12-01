use candid::Principal;

use kong_lib::ic::management_canister::ManagementCanister;

use kong_lib::solana::error::SolanaError;
use kong_lib::solana::base58;

// Known program IDs on Solana network
pub const SYSTEM_PROGRAM_ID: &str = "11111111111111111111111111111111";
pub const MEMO_PROGRAM_ID: &str = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
pub const TOKEN_PROGRAM_ID: &str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
pub const ASSOCIATED_TOKEN_PROGRAM_ID: &str = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
pub const SYSVAR_RENT_PROGRAM_ID: &str = "SysvarRent111111111111111111111111111111111";
pub const COMPUTE_BUDGET_PROGRAM_ID: &str = "ComputeBudget111111111111111111111111111111";

pub struct SolanaNetwork;

impl SolanaNetwork {
    pub async fn get_public_key(canister: &Principal) -> Result<String, SolanaError> {
        let derivation_path = ManagementCanister::get_canister_derivation_path(canister);

        // Get the Schnorr public key - fail properly if not available
        let public_key_bytes = ManagementCanister::get_schnorr_public_key(canister, derivation_path)
            .await
            .map_err(|e| SolanaError::PublicKeyRetrievalError(e.to_string()))?;

        Ok(base58::encode(&public_key_bytes))
    }
}
