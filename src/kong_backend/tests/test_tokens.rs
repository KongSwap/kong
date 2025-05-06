pub mod common;

use candid::{decode_one, encode_one, Principal};
use kong_backend::tokens::tokens_reply::TokensReply;

use common::setup::setup_ic_environment;

#[test]
fn test_tokens() {
    let (ic, kong_backend) = setup_ic_environment().expect("Failed to setup IC environment");

    let args = encode_one(()).expect("Failed to encode arguments for tokens");
    let Ok(response) = ic.query_call(kong_backend, Principal::anonymous(), "tokens", args) else {
        panic!("Failed to query tokens");
    };
    let result = decode_one::<Result<Vec<TokensReply>, String>>(&response).expect("Failed to decode tokens response");

    assert!(result.is_ok(), "tokens should be Ok, but got {:?}", result);
}

#[test]
fn test_tokens_unknown_token() {
    let (ic, kong_backend) = setup_ic_environment().expect("Failed to setup IC environment");

    let args = encode_one("unknown_token").expect("Failed to encode arguments for tokens");
    let Ok(response) = ic.query_call(kong_backend, Principal::anonymous(), "tokens", args) else {
        panic!("Failed to query tokens");
    };
    let result = decode_one::<Result<Vec<TokensReply>, String>>(&response).expect("Failed to decode tokens response");

    assert!(result.is_ok(), "tokens should be Ok, but got {:?}", result);
    let tokens = result.unwrap();
    assert_eq!(tokens.len(), 0, "tokens should be empty, but got {:?}", tokens);
}
