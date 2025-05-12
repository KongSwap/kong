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
pub fn create_canister_at_id(
    ic: &PocketIc,
    id_to_create: Principal,
    controller: Principal, // The controller for the new canister
) -> Result<Principal, String> { // Returns Result as per PocketIc API
    let settings = CanisterSettings { // Using ic_management_canister_types::CanisterSettings
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
    match ic.create_canister_with_id(Some(controller), Some(settings), id_to_create) {
        Ok(canister_id) => {
            ic.add_cycles(canister_id, 10_000_000_000_000); // Add default cycles
            Ok(canister_id)
        }
        Err(e) => Err(e), // e is already a String error message
    }
}
