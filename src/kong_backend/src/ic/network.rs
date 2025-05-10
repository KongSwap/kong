use candid::Principal;

pub struct ICNetwork {}

impl ICNetwork {
    pub fn canister_id() -> Principal {
        ic_cdk::id()
    }

    pub fn get_canister_derivation_path() -> Vec<Vec<u8>> {
        // use the canister's principal as the derivation path
        vec![ICNetwork::canister_id().as_slice().to_vec()]
    }

    /// Get the key name for the Ed25519 key
    pub fn get_ed25519_key_name() -> String {
        // Based on the error message, the available key is "dfx_test_key"
        // We'll use this for both networks for now, but in production
        // this should be configured properly
        // dfx_text_key local replica
        // test_key_1 Test key available on the ICP testnet
        // key_1 Production key available on the ICP mainnet
        "dfx_test_key".to_string()
    }

    /// Log an error message
    pub fn error_log(message: &str) {
        ic_cdk::println!("ERROR: {}", message);
    }

    /// Log an informational message
    pub fn info_log(message: &str) {
        ic_cdk::println!("INFO: {}", message);
    }
}