use candid::Principal;
use ic_cdk::api::management_canister::main::{canister_status, CanisterIdRecord, CanisterStatusResponse};

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
