use anyhow::Result;
use candid::Principal;
use ic_cdk::api::management_canister::main::{canister_status, CanisterIdRecord, CanisterStatusResponse};
use ic_cdk::api::management_canister::schnorr::{
    SchnorrAlgorithm, SchnorrKeyId, SchnorrPublicKeyArgument, SchnorrPublicKeyResponse, SignWithSchnorrArgument, SignWithSchnorrResponse,
};
use rand::{rngs::StdRng, SeedableRng};
use std::sync::OnceLock;

use super::error::ICError;
use super::network::ICNetwork;

const SIGN_WITH_SCHNORR_CYCLES: u64 = 26_153_846_153; // Adjust cycles as needed
static DERIVATION_PATH: OnceLock<Vec<Vec<u8>>> = OnceLock::new();
static ED25519_KEY_NAME: OnceLock<String> = OnceLock::new();

pub struct ManagementCanister {}

impl ManagementCanister {
    /// Retrieves a random seed from the IC's management canister.
    ///
    /// # Returns
    ///
    /// * `Ok(StdRng)` - A random number generator seeded with the retrieved seed.
    /// * `Err(String)` - An error message if the operation fails.
    pub async fn get_random_seed() -> Result<StdRng, String> {
        let (seed,): ([u8; 32],) = ic_cdk::call(Principal::management_canister(), "raw_rand", ())
            .await
            .map_err(|e| e.1)?;
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

    pub async fn get_canister_status(canister_id: &Principal) -> Result<CanisterStatusResponse, String> {
        let (status,) = canister_status(CanisterIdRecord { canister_id: *canister_id })
            .await
            .map_err(|e| e.1)?;
        Ok(status)
    }

    /// Get the key name for the Ed25519 key
    pub fn get_ed25519_key_name() -> String {
        // Cache the key name since it's determined at compile time
        ED25519_KEY_NAME
            .get_or_init(|| {
                // Key selection based on build-time feature flags:
                // dfx_test_key - local replica only
                // test_key_1 - Test key available on the ICP testnet
                // key_1 - Production key available on the ICP mainnet

                if cfg!(feature = "prod") {
                    "key_1".to_string()
                } else if cfg!(feature = "staging") {
                    "test_key_1".to_string()
                } else {
                    // default to the test key for local development
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

    pub async fn get_schnorr_public_key(canister: &Principal, derivation_path: Vec<Vec<u8>>) -> Result<Vec<u8>> {
        let request = SchnorrPublicKeyArgument {
            canister_id: Some(*canister),
            derivation_path,
            key_id: SchnorrKeyId {
                algorithm: SchnorrAlgorithm::Ed25519,
                name: ManagementCanister::get_ed25519_key_name(),
            },
        };

        // call the management canister to get the Ed25519 public key
        match ic_cdk::call::<(SchnorrPublicKeyArgument,), (SchnorrPublicKeyResponse,)>(
            Principal::management_canister(),
            "schnorr_public_key",
            (request,),
        )
        .await
        {
            Ok((response,)) => Ok(response.public_key),
            Err(e) => Err(ICError::SchnorrPublicKeyError(format!("Failed to get Ed25519 public key: {:?}", e)))?,
        }
    }

    pub async fn sign_with_schnorr(canister: &Principal, data: &[u8]) -> Result<Vec<u8>> {
        let request = SignWithSchnorrArgument {
            message: data.to_vec(),
            derivation_path: ManagementCanister::get_canister_derivation_path(canister),
            key_id: SchnorrKeyId {
                algorithm: SchnorrAlgorithm::Ed25519,
                name: ManagementCanister::get_ed25519_key_name(),
            },
        };

        // call the management canister to sign the message with Schnorr
        match ic_cdk::api::call::call_with_payment::<(SignWithSchnorrArgument,), (SignWithSchnorrResponse,)>(
            Principal::management_canister(),
            "sign_with_schnorr",
            (request,),
            SIGN_WITH_SCHNORR_CYCLES,
        )
        .await
        {
            Ok((response,)) => Ok(response.signature),
            Err(e) => Err(ICError::SchnorrSignatureError(format!("Failed to sign transaction: {:?}", e)))?,
        }
    }
}
