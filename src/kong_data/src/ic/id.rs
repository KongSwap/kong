use candid::Principal;
use icrc_ledger_types::icrc1::account::Account;

/// Principal of Kong backend
pub fn kong_backend() -> Principal {
    ic_cdk::api::id()
}

/// Cansiter ID of Kong backend
pub fn kong_backend_id() -> String {
    ic_cdk::api::id().to_text()
}

/// Account of Kong backend
pub fn kong_account() -> Account {
    Account::from(kong_backend())
}

/// Principal ID of the caller.
pub fn caller() -> Principal {
    ic_cdk::api::caller()
}

/// Principal ID (String) of the caller.
pub fn caller_principal_id() -> String {
    caller().to_text()
}

/// Check if the caller is a controller
pub fn is_caller_controller() -> bool {
    ic_cdk::api::is_controller(&caller())
}

/// Check to make sure Principal Id is not anonymous
pub fn principal_id_is_not_anonymous(principal_id: &str) -> Result<(), String> {
    if principal_id == Principal::anonymous().to_text() {
        return Err("Anonymous user not allowed".to_string());
    }
    Ok(())
}
