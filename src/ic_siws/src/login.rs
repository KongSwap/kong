use std::fmt;

use candid::{CandidType, Principal};
use serde::Deserialize;
use serde_bytes::ByteBuf;
use simple_asn1::ASN1EncodeErr;

use crate::{
    delegation::{
        create_delegation, create_delegation_hash, create_user_canister_pubkey, generate_seed,
        DelegationError,
    },
    hash,
    settings::Settings,
    signature_map::SignatureMap,
    siws::{SiwsMessage, SiwsMessageError},
    solana::{verify_sol_signature, SolError, SolPubkey, SolSignature},
    time::get_current_time,
    with_settings, SIWS_MESSAGES,
};

const MAX_SIGS_TO_PRUNE: usize = 10;

/// This function is the first step of the user login process. It validates the provided Solana address,
/// creates a SIWS message, saves it for future use, and returns it.
///
/// # Example
/// ```ignore
/// use ic_siws::{
///   login::prepare_login,
///   solana::SolPubkey
/// };
///
/// let address = SolPubkey::from_str("Awes4Tr6TX8JDzEhCZY2QVNimT6iD1zWHzf1vNyGvpLM").unwrap()
/// let message = prepare_login(&address).unwrap();
/// ```
pub fn prepare_login(address: &SolPubkey) -> SiwsMessage {
    let message = SiwsMessage::new(address);

    // Save the SIWS message for use in the login call
    SIWS_MESSAGES.with_borrow_mut(|siws_messages| {
        siws_messages.insert(address, message.clone());
    });

    message
}

/// Login details are returned after a successful login. They contain the expiration time of the
/// delegation and the user canister public key.
#[derive(Clone, Debug, CandidType, Deserialize)]
pub struct LoginDetails {
    /// The session expiration time in nanoseconds since the UNIX epoch. This is the time at which
    /// the delegation will no longer be valid.
    pub expiration: u64,

    /// The user canister public key. This key is used to derive the user principal.
    pub user_canister_pubkey: ByteBuf,
}

pub enum LoginError {
    SignatureError(SolError),
    SiwsMessageError(SiwsMessageError),
    AddressMismatch,
    DelegationError(DelegationError),
    ASN1EncodeErr(ASN1EncodeErr),
}

impl From<SolError> for LoginError {
    fn from(err: SolError) -> Self {
        LoginError::SignatureError(err)
    }
}

impl From<SiwsMessageError> for LoginError {
    fn from(err: SiwsMessageError) -> Self {
        LoginError::SiwsMessageError(err)
    }
}

impl From<DelegationError> for LoginError {
    fn from(err: DelegationError) -> Self {
        LoginError::DelegationError(err)
    }
}

impl From<ASN1EncodeErr> for LoginError {
    fn from(err: ASN1EncodeErr) -> Self {
        LoginError::ASN1EncodeErr(err)
    }
}

impl fmt::Display for LoginError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            LoginError::SignatureError(e) => write!(f, "{}", e),
            LoginError::SiwsMessageError(e) => write!(f, "{}", e),
            LoginError::AddressMismatch => write!(f, "Recovered address does not match"),
            LoginError::DelegationError(e) => write!(f, "{}", e),
            LoginError::ASN1EncodeErr(e) => write!(f, "{}", e),
        }
    }
}

/// Handles the second step of the user login process. It verifies a signature against the stored SIWS message,
/// creates a delegation for the session, adds it to the signature map, and returns login details
///
/// # Parameters
/// * `signature`: The SIWS message signature to verify.
/// * `address`: The Solana address used to sign the SIWS message.
/// * `session_key`: A unique session key to be used for the delegation.
/// * `signature_map`: A mutable reference to `SignatureMap` to which the delegation hash will be added
///   after successful validation.
/// * `canister_id`: The principal of the canister performing the login.
///
/// # Returns
/// A `Result` that, on success, contains the [LoginDetails] with session expiration and user canister
/// public key, or an error string on failure.
pub fn login(
    signature: &SolSignature,
    address: &SolPubkey,
    session_key: ByteBuf,
    signature_map: &mut SignatureMap,
    canister_id: &Principal,
) -> Result<LoginDetails, LoginError> {
    // Remove expired SIWS messages from the state before proceeding. The init settings determines
    // the time to live for SIWS messages.
    SIWS_MESSAGES.with_borrow_mut(|siws_messages| {
        // Prune any expired SIWS messages from the state.
        siws_messages.prune_expired();

        // Get the previously created SIWS message for current address. If it has expired or does not
        // exist, return an error.
        let message = siws_messages.get(address)?;
        let message_string: String = message.clone().into();

        // Verify the supplied signature and public key against the stored SIWS message.
        verify_sol_signature(&message_string, signature, address)
            .map_err(LoginError::SignatureError)?;

        // At this point, the signature has been verified and the SIWS message has been used. Remove
        // the SIWS message from the state.
        siws_messages.remove(address);

        // The delegation is valid for the duration of the session as defined in the settings.
        let expiration = with_settings!(|settings: &Settings| {
            message
                .issued_at
                .saturating_add(settings.session_expires_in)
        });

        // The seed is what uniquely identifies the delegation. It is derived from the salt, the
        // Solana address and the SIWS message URI.
        let seed = generate_seed(address);

        // Before adding the signature to the signature map, prune any expired signatures.
        signature_map.prune_expired(get_current_time(), MAX_SIGS_TO_PRUNE);

        // Create the delegation and add its hash to the signature map. The seed is used as the map key.
        let delegation = create_delegation(session_key, expiration)?;
        let delegation_hash = create_delegation_hash(&delegation);
        signature_map.put(hash::hash_bytes(seed), delegation_hash);

        // Create the user canister public key from the seed. From this key, the client can derive the
        // user principal.
        let user_canister_pubkey = create_user_canister_pubkey(canister_id, seed.to_vec())?;

        Ok(LoginDetails {
            expiration,
            user_canister_pubkey: ByteBuf::from(user_canister_pubkey),
        })
    })
}
