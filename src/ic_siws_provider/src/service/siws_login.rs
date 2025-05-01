use std::str::FromStr;

use candid::Principal;
use ic_cdk::update;
use ic_siws::{
    login::LoginDetails,
    solana::{SolPubkey, SolSignature},
};
use ic_stable_structures::storable::Blob;
use serde_bytes::ByteBuf;

use crate::{update_root_hash, ADDRESS_PRINCIPAL, PRINCIPAL_ADDRESS, SETTINGS, STATE};

/// Authenticates the user by verifying the signature of the SIWS message. This function also
/// prepares the delegation to be fetched in the next step, the `siws_get_delegation` function.
///
/// # Arguments
/// * `signature` (String): The signature of the SIWS message.
/// * `address` (String): The Solana address of the user.
/// * `session_key` (ByteBuf): A unique key that identifies the session.
///
/// # Returns
/// * `Ok(LoginOkResponse)`: Contains the user canister public key and other login response data if the login is successful.
/// * `Err(String)`: An error message if the login process fails.
#[update]
fn siws_login(
    signature: String,
    pubkey: String,
    session_key: ByteBuf,
) -> Result<LoginDetails, String> {
    STATE.with(|state| {
        let signature_map = &mut *state.signature_map.borrow_mut();

        let pubkey = SolPubkey::from_str(pubkey.as_str()).map_err(|e| e.to_string())?;

        // Create an EthSignature from the string. This validates the signature.
        let signature = SolSignature::from_str(signature.as_str()).map_err(|e| e.to_string())?;

        // Attempt to log in with the provided signature, address, and session key.
        let login_response = ic_siws::login::login(
            &signature,
            &pubkey,
            session_key,
            &mut *signature_map,
            &ic_cdk::api::id(),
        )
        .map_err(|e| e.to_string())?;

        // Update the certified data of the canister due to changes in the signature map.
        update_root_hash(&state.asset_hashes.borrow(), signature_map);

        // Convert the user canister public key to a principal.
        let principal: Blob<29> =
            Principal::self_authenticating(&login_response.user_canister_pubkey).as_slice()[..29]
                .try_into()
                .map_err(|_| format!("Invalid principal: {:?}", login_response))?;

        // Store the mapping of principal to Solana address and vice versa if the settings allow it.
        manage_principal_address_mappings(&principal, &pubkey);

        Ok(login_response)
    })
}

fn manage_principal_address_mappings(principal: &Blob<29>, pubkey: &SolPubkey) {
    SETTINGS.with(|s| {
        if !s.borrow().disable_principal_to_sol_mapping {
            PRINCIPAL_ADDRESS.with(|pa| {
                pa.borrow_mut().insert(*principal, pubkey.to_bytes());
            });
        }
        if !s.borrow().disable_sol_to_principal_mapping {
            ADDRESS_PRINCIPAL.with(|ap| {
                ap.borrow_mut().insert(pubkey.to_bytes(), *principal);
            });
        }
    });
}
