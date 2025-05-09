use candid::Principal;
use ic_management_canister_types::CanisterSettings;
use pocket_ic::PocketIc;

pub fn create_canister(
    ic: &PocketIc,
    controller: &Option<Principal>,
    settings: &Option<CanisterSettings>,
    canister_id: Option<Principal>,
) -> Principal {
    let canister_principal = match canister_id {
        Some(id) => ic.create_canister_with_id(*controller, settings.clone(), id).unwrap(),
        None => ic.create_canister_with_settings(*controller, settings.clone()),
    };
    ic.add_cycles(canister_principal, 10_000_000_000_000); // 10T Cycles
    canister_principal
}
