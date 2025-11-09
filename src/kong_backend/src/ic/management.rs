use candid::Principal;
use ic_cdk::management_canister::CanisterStatusResult;
use rand::rngs::StdRng;

/// Retrieves a random seed from the IC's management canister.
///
/// # Returns
///
/// * `Ok(StdRng)` - A random number generator seeded with the retrieved seed.
/// * `Err(String)` - An error message if the operation fails.
#[allow(dead_code)]
pub async fn get_random_seed() -> Result<StdRng, String> {
    kong_lib::ic::management_canister::ManagementCanister::get_random_seed().await
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
    kong_lib::ic::management_canister::ManagementCanister::get_pseudo_seed()
}

#[allow(dead_code)]
pub async fn get_canister_status(canister_id: &Principal) -> Result<CanisterStatusResult, String> {
    kong_lib::ic::management_canister::ManagementCanister::get_canister_status(canister_id).await
}

#[allow(dead_code)]
pub fn get_performance_counter(counter_type: u32) -> u64 {
    ic_cdk::api::performance_counter(counter_type)
}
