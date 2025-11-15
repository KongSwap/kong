use candid::Principal;
use ic_cdk::management_canister::{canister_status, CanisterStatusArgs, CanisterStatusResult};

#[allow(dead_code)]
pub async fn get_canister_status(canister_id: &Principal) -> Result<CanisterStatusResult, String> {
    let status = canister_status(&CanisterStatusArgs { canister_id: *canister_id })
        .await
        .map_err(|e| e.to_string())?;
    Ok(status)
}

#[allow(dead_code)]
pub fn get_performance_counter(counter_type: u32) -> u64 {
    ic_cdk::api::performance_counter(counter_type)
}
