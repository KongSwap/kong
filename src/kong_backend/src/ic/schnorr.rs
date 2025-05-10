use anyhow::Result;
use candid::Principal;
use ic_cdk::api::management_canister::schnorr::{
    SchnorrAlgorithm, SchnorrKeyId, SchnorrPublicKeyArgument, SchnorrPublicKeyResponse,
    SignWithSchnorrArgument, SignWithSchnorrResponse,
};

use super::error::ICError;
use super::network::ICNetwork;

const SIGN_WITH_SCHNORR_CYCLES: u64 = 26_153_846_153; // Adjust cycles as needed

impl ICNetwork {
    pub async fn get_schnorr_public_key(derivation_path: Vec<Vec<u8>>) -> Result<Vec<u8>> {
        let request = SchnorrPublicKeyArgument {
            canister_id: Some(ICNetwork::canister_id()),
            derivation_path,
            key_id: SchnorrKeyId {
                algorithm: SchnorrAlgorithm::Ed25519,
                name: ICNetwork::get_ed25519_key_name(),
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
            Err(e) => Err(ICError::SchnorrPublicKeyError(format!(
                "Failed to get Ed25519 public key: {:?}",
                e
            )))?,
        }
    }

    pub async fn sign_with_schnorr(data: &[u8]) -> Result<Vec<u8>> {
        let request = SignWithSchnorrArgument {
            message: data.to_vec(),
            derivation_path: ICNetwork::get_canister_derivation_path(),
            key_id: SchnorrKeyId {
                algorithm: SchnorrAlgorithm::Ed25519,
                name: ICNetwork::get_ed25519_key_name(),
            },
        };

        // call the management canister to sign the message with Schnorr
        match ic_cdk::api::call::call_with_payment::<
            (SignWithSchnorrArgument,),
            (SignWithSchnorrResponse,),
        >(
            Principal::management_canister(),
            "sign_with_schnorr",
            (request,),
            SIGN_WITH_SCHNORR_CYCLES,
        )
        .await
        {
            Ok((response,)) => Ok(response.signature),
            Err(e) => Err(ICError::SchnorrSignatureError(format!(
                "Failed to sign transaction: {:?}",
                e
            )))?,
        }
    }
}