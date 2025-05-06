pub mod common;

use candid::{decode_one, encode_one, Principal};

use common::identity::{get_identity_from_pem_file, get_new_identity};
use common::setup::{setup_ic_environment, CONTROLLER_PEM_FILE};

#[test]
fn test_controllers_as_anonymous() {
    const ANONYMOUS: &str = "Anonymous user not allowed";

    let (ic, kong_backend) = setup_ic_environment().expect("Failed to setup IC environment");

    let args = encode_one(()).expect("Failed to encode arguments for status");
    let response = match ic.query_call(kong_backend, Principal::anonymous(), "status", args) {
        Ok(response) => response,
        Err(err) => {
            assert_eq!(
                err.reject_message, ANONYMOUS,
                "status should be rejected with message '{}'",
                ANONYMOUS
            );
            return;
        }
    };
    let result = decode_one::<Result<String, String>>(&response).expect("Failed to decode status response");

    panic!("status should be rejected, but got {:?}", result);
}

#[test]
fn test_controllers_as_user() {
    const NOT_CONTROLLER: &str = "Caller is not King Kong";

    let (ic, kong_backend) = setup_ic_environment().expect("Failed to setup IC environment");
    let user_identity = get_new_identity().expect("Failed to get new identity");

    let user_principal_id = user_identity.sender().expect("Failed to get user principal id");

    let args = encode_one(()).expect("Failed to encode arguments for status");
    let response = match ic.query_call(kong_backend, user_principal_id, "status", args) {
        Ok(response) => response,
        Err(err) => {
            assert_eq!(
                err.reject_message, NOT_CONTROLLER,
                "status should be rejected with message '{}'",
                NOT_CONTROLLER
            );
            return;
        }
    };
    let result = decode_one::<Result<String, String>>(&response).expect("Failed to decode status response");

    panic!("status should be rejected, but got {:?}", result);
}

#[test]
fn test_controllers_as_controller() {
    let (ic, kong_backend) = setup_ic_environment().expect("Failed to setup IC environment");

    let controller_identity = get_identity_from_pem_file(CONTROLLER_PEM_FILE).expect("Failed to get controller identity");
    let controller_principal_id = controller_identity.sender().expect("Failed to get controller principal id");

    let args = encode_one(()).expect("Failed to encode arguments for status");
    let response = match ic.query_call(kong_backend, controller_principal_id, "status", args) {
        Ok(response) => response,
        Err(err) => {
            println!("{:?}", err.reject_message);
            return;
        }
    };
    let result = decode_one::<Result<String, String>>(&response).expect("Failed to decode status response");

    assert!(result.is_ok(), "status should be Ok, but got {:?}", result);
}
