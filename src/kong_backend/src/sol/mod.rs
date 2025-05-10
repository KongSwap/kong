use ic_cdk::api::management_canister::http_request::{HttpResponse, TransformArgs};
use ic_cdk::api::management_canister::schnorr::{
    schnorr_public_key, SchnorrAlgorithm, SchnorrKeyId, SchnorrPublicKeyArgument,
};
use ic_cdk::api::caller as caller_api; // To get canister's own principal for derivation path

pub mod error;
pub mod network;
pub mod rpc;
pub mod sdk;
pub mod transactions;
pub mod verify;
pub mod address;
pub mod ledger;
pub mod transfer;
pub mod constants;
pub mod signature;
pub mod utils;

/// Solana module for Kong DEX integration
/// Utilizes Internet Computer's Chain-Key technology for Solana blockchain support

/// Initialize Solana RPC client with the specified endpoint
pub async fn init_solana_client(rpc_endpoint: &str) -> Result<rpc::client::SolanaRpcClient, String> {
    let network = network::SolanaNetwork::new(rpc_endpoint);
    Ok(rpc::client::SolanaRpcClient::new(network))
}

/// Transform function for Solana HTTP responses
/// Required for Internet Computer HTTP outcalls
pub fn transform_solana_response(args: TransformArgs) -> HttpResponse {
    args.response
}

/// Gets the Kong backend's own Solana public key derived using chain-key (Ed25519).
/// This key can be used as Kong's identity on the Solana network.
#[ic_cdk_macros::update]
async fn get_kong_solana_chain_key_address() -> Result<String, String> {
    // Define the key ID for Ed25519.
    // "dfx_test_key_1" is a common test key. For production, a specific key name should be used.
    // Other options could be "key_1", "test_key_1".
    let key_id = SchnorrKeyId {
        algorithm: SchnorrAlgorithm::Ed25519,
        name: "dfx_test_key_1".to_string(), // Or another appropriate key name
    };

    // Use the canister's own principal for the derivation path to ensure a unique key per canister.
    // You can add more sub-paths if needed, e.g., for different purposes.
    let derivation_path = vec![caller_api().as_slice().to_vec()];

    let public_key_args = SchnorrPublicKeyArgument {
        canister_id: None, // Use this canister's ID
        derivation_path,
        key_id,
    };

    match schnorr_public_key(public_key_args).await {
        Ok((response,)) => {
            // The public key is raw bytes. Solana addresses are typically base58 encoded.
            Ok(bs58::encode(response.public_key).into_string())
        }
        Err((code, msg)) => Err(format!(
            "Failed to get Schnorr public key: code {:?}, message: {}",
            code, msg
        )),
    }
}