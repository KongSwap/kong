// use anyhow::Result;
use candid::Principal;
use ic_cdk::management_canister::{
    canister_status, schnorr_public_key, sign_with_schnorr,
    CanisterStatusArgs, CanisterStatusResult,
    SchnorrAlgorithm, SchnorrKeyId, SchnorrPublicKeyArgs, SignWithSchnorrArgs,
};
use rand::{rngs::StdRng, SeedableRng};
use std::sync::OnceLock;

use super::error::ICError;
use super::network::ICNetwork;

static DERIVATION_PATH: OnceLock<Vec<Vec<u8>>> = OnceLock::new();
static ED25519_KEY_NAME: OnceLock<String> = OnceLock::new();

pub struct ManagementCanister;

impl ManagementCanister {
    /// Retrieves a random seed from the IC's management canister.
    ///
    /// # Returns
    ///
    /// * `Ok(StdRng)` - A random number generator seeded with the retrieved seed.
    /// * `Err(String)` - An error message if the operation fails.
    pub async fn get_random_seed() -> Result<StdRng, String> {
        let (seed,): ([u8; 32],) = ic_cdk::call::Call::unbounded_wait(Principal::management_canister(), "raw_rand")
            .await
            .map_err(|e| format!("{:?}", e))?
            .candid::<([u8; 32],)>()
            .map_err(|e| format!("{:?}", e))?;
        Ok(StdRng::from_seed(seed))
    }

    /// Generates a pseudo-random seed based on the current timestamp.
    ///
    /// This function avoids inter-canister calls and should not be used for cryptographic purposes.
    ///
    /// # Returns
    ///
    /// * `Ok(StdRng)` - A random number generator seeded with the current timestamp.
    /// * `Err(String)` - An error message if the operation fails.
    pub fn get_pseudo_seed() -> Result<StdRng, String> {
        let seed = ICNetwork::get_time();
        Ok(StdRng::seed_from_u64(seed)) // simple way to generate a pseudo random seed
    }

    pub async fn get_canister_status(canister_id: &Principal) -> Result<CanisterStatusResult, String> {
        let status = canister_status(&CanisterStatusArgs { canister_id: *canister_id })
            .await
            .map_err(|e| format!("{:?}", e))?;
        Ok(status)
    }

    /// Get the key name for the Ed25519 key
    pub fn get_ed25519_key_name() -> String {
        // Cache the key name since it's determined at compile time
        ED25519_KEY_NAME
            .get_or_init(|| {
                // Key selection based on build-time feature flags.
                // These are the official IC threshold signature key names:
                // - "dfx_test_key": Only available on local dfx development environment
                // - "test_key_1": Test key available on ICP mainnet (for testing purposes)
                // - "key_1": Production key available on ICP mainnet

                if cfg!(feature = "prod") {
                    "key_1".to_string()
                } else if cfg!(feature = "staging") {
                    "test_key_1".to_string()
                } else {
                    // Default to local dfx key for development
                    "dfx_test_key".to_string()
                }
            })
            .clone()
    }

    pub fn get_canister_derivation_path(canister: &Principal) -> Vec<Vec<u8>> {
        // Cache the derivation path since it never changes during runtime
        DERIVATION_PATH
            .get_or_init(|| {
                // use the canister's principal as the derivation path
                vec![canister.as_slice().to_vec()]
            })
            .clone()
    }

    pub async fn get_schnorr_public_key(canister: &Principal, derivation_path: Vec<Vec<u8>>) -> Result<Vec<u8>, ICError> {
        let request = SchnorrPublicKeyArgs {
            canister_id: Some(*canister),
            derivation_path,
            key_id: SchnorrKeyId {
                algorithm: SchnorrAlgorithm::Ed25519,
                name: ManagementCanister::get_ed25519_key_name(),
            },
        };

        schnorr_public_key(&request)
            .await
            .map(|response| response.public_key)
            .map_err(|e| {
                let error_msg = e.to_string();
                // Local development doesn't support Schnorr - return special error
                if error_msg.contains("CallRejected") || error_msg.contains("reject_code: 3") {
                    ICError::SchnorrPublicKeyError("LOCAL_DEVELOPMENT_SCHNORR_UNAVAILABLE".to_string()).into()
                } else {
                    ICError::SchnorrPublicKeyError(format!("Failed to get Ed25519 public key: {}", error_msg)).into()
                }
            })
    }

    pub async fn sign_with_schnorr(canister: &Principal, data: &[u8]) -> Result<Vec<u8>, ICError> {
        let request = SignWithSchnorrArgs {
            message: data.to_vec(),
            derivation_path: ManagementCanister::get_canister_derivation_path(canister),
            key_id: SchnorrKeyId {
                algorithm: SchnorrAlgorithm::Ed25519,
                name: ManagementCanister::get_ed25519_key_name(),
            },
            aux: None,
        };

        sign_with_schnorr(&request)
            .await
            .map(|response| response.signature)
            .map_err(|e| ICError::SchnorrSignatureError(format!("Failed to sign transaction: {}", e)).into())
    }
}
