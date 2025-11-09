use candid::Principal;
use ic_ledger_types::AccountIdentifier;
use icrc_ledger_types::icrc1::account::Account;
use kong_lib::ic::id as ic_id;

/// Account of the canister.
#[allow(dead_code)]
pub fn canister_id() -> Account {
    Account::from(ic_id::canister())
}

/// Principal ID of the caller.
pub fn caller() -> Principal {
    ic_id::caller()
}

/// Principal ID (String) of the caller.
pub fn caller_principal_id() -> String {
    ic_id::caller_principal_id()
}

/// Account of the caller.
pub fn caller_id() -> Account {
    ic_id::caller_id()
}

/// Account ID of the caller.
/// Used for ICP token
pub fn caller_account_id() -> AccountIdentifier {
    ic_id::caller_account_id()
}

/// Check if the caller is a controller
pub fn is_caller_controller() -> bool {
    ic_id::is_caller_controller()
}

/// Check to make sure Principal Id is not anonymous
pub fn principal_id_is_not_anonymous(principal_id: &str) -> Result<(), String> {
    ic_id::principal_id_is_not_anonymous(principal_id)
}

/// Account Id for Principal
pub fn principal_to_account_id(principal: Principal) -> AccountIdentifier {
    ic_id::principal_to_account_id(principal)
}
