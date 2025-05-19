use anyhow::{anyhow, Result};
use candid::Principal;
use ic_management_canister_types::CanisterSettings; // This is the correct Settings type
use pocket_ic::PocketIc;

pub fn create_canister(ic: &PocketIc, controller: &Option<Principal>, settings: &Option<CanisterSettings>) -> Principal {
    // This should call the 2-argument version of create_canister_with_settings
    let canister = ic.create_canister_with_settings(*controller, settings.clone());
    ic.add_cycles(canister, 10_000_000_000_000); // 10T Cycles
    canister
}

/// Creates a canister with a specified ID and controller using PocketIc's create_canister_with_id.
pub fn create_canister_with_id(
    ic: &PocketIc,
    canister_id: Principal,
    controller: Principal, // The controller for the new canister
) -> Result<Principal> {
    // Returns Result as per PocketIc API
    let settings = CanisterSettings {
        // Using ic_management_canister_types::CanisterSettings
        controllers: Some(vec![controller]),
        compute_allocation: None,
        memory_allocation: None,
        freezing_threshold: None,
        reserved_cycles_limit: None,
        log_visibility: None,
        wasm_memory_limit: None,
        wasm_memory_threshold: None,
    };

    // Call PocketIc's 3-argument create_canister_with_id method.
    // Using `Some(controller)` as the sender for this operation.
    match ic.create_canister_with_id(Some(controller), Some(settings), canister_id) {
        Ok(canister_id) => {
            ic.add_cycles(canister_id, 10_000_000_000_000); // Add default cycles
            Ok(canister_id)
        }
        Err(e) => Err(anyhow!(e)),
    }
}

pub fn create_canister_on_fiduciary_subnet(
    ic: &PocketIc,
    controller: &Option<Principal>,
    settings: &Option<CanisterSettings>,
) -> Result<Principal> {
    // get the fiduciary subnet principal
    let topology = ic.topology();
    let fiduciary_subnet_principal = topology.get_fiduciary().ok_or_else(|| anyhow!("No fiduciary subnet found"))?;

    let canister = ic.create_canister_on_subnet(*controller, settings.clone(), fiduciary_subnet_principal);
    ic.add_cycles(canister, 10_000_000_000_000); // 10T Cycles
    Ok(canister)
}

pub fn create_canister_on_application_subnet(
    ic: &PocketIc,
    controller: &Option<Principal>,
    settings: &Option<CanisterSettings>,
) -> Result<Principal> {
    // get the application subnet principal
    let topology = ic.topology();
    let application_subnet_principal = topology
        .get_app_subnets()
        .into_iter()
        .next()
        .ok_or_else(|| anyhow!("No application subnet found"))?;

    let canister = ic.create_canister_on_subnet(*controller, settings.clone(), application_subnet_principal);
    ic.add_cycles(canister, 10_000_000_000_000); // 10T Cycles
    Ok(canister)
}
