use candid::Principal;

pub fn caller() -> Principal {
    ic_cdk::api::msg_caller()
}

pub fn is_caller_anonymous() -> bool {
    caller() == Principal::anonymous()
}
