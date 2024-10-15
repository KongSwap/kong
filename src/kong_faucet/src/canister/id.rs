use candid::Principal;
use icrc_ledger_types::icrc1::account::Account;

pub fn caller() -> Principal {
    ic_cdk::api::caller()
}

pub fn caller_id() -> Account {
    Account::from(caller())
}

pub fn caller_principal_id() -> String {
    caller().to_text()
}

pub fn is_caller_anonymous() -> bool {
    caller() == Principal::anonymous()
}
