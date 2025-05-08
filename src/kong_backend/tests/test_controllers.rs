pub mod common;

use candid::{decode_one, encode_one, Principal};

use common::identity::get_new_identity;
use common::setup::setup_ic_environment;

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
    
    // Get the controller from PocketIc
    let controllers = ic.get_controllers(kong_backend);
    assert!(!controllers.is_empty(), "Failed to get controllers");
    let controller_principal_id = controllers[0];

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