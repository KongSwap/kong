use candid::Principal;
use ic_management_canister_types::CanisterSettings;
use pocket_ic::PocketIc;

pub fn create_canister(
    ic: &PocketIc,
    controller: &Option<Principal>,
    settings: &Option<CanisterSettings>,
) -> Principal {
    let canister = ic.create_canister_with_settings(*controller, settings.clone());
    ic.add_cycles(canister, 5_000_000_000_000); // 5T Cycles
    canister
}
