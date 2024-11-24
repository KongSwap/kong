use candid::Principal;
use ic_cdk::api::management_canister::main::{canister_status, CanisterIdRecord, CanisterStatusResponse};
use rand::{rngs::StdRng, SeedableRng};

use super::get_time::get_time;

/// Retrieves a random seed from the IC's management canister.
///
/// # Returns
///
/// * `Ok(StdRng)` - A random number generator seeded with the retrieved seed.
/// * `Err(String)` - An error message if the operation fails.
#[allow(dead_code)]
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
    let seed = get_time();
    Ok(StdRng::seed_from_u64(seed)) // simple way to generate a pseudo random seed
}

#[allow(dead_code)]
pub async fn get_canister_status(canister_id: &Principal) -> Result<CanisterStatusResponse, String> {
    let (status,) = canister_status(CanisterIdRecord { canister_id: *canister_id })
        .await
        .map_err(|e| e.1)?;
    Ok(status)
}

#[allow(dead_code)]
pub fn get_performance_counter(counter_type: u32) -> u64 {
    ic_cdk::api::performance_counter(counter_type)
}
