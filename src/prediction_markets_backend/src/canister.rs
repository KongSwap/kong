use candid::{CandidType, Deserialize, Principal};
use ic_cdk::{caller, query, update};
use std::time::{SystemTime, UNIX_EPOCH};

use super::delegation::*;
use super::stable_memory::*;

// Helper function to get current time in nanoseconds
pub fn get_current_time() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos() as u64
}

// We'll implement our own simple hash function since we don't have sha2
pub fn hash_principals(principals: &[Principal]) -> Vec<u8> {
    let mut result = Vec::new();
    for principal in principals {
        result.extend_from_slice(principal.as_slice());
    }
    result
}

#[derive(CandidType, Deserialize, Debug)]
pub struct ICRC21ConsentMessageRequest {
    pub canister: Principal,
    pub method: String,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct ICRC21ConsentMessageResponse {
    pub consent_message: String,
}

/// Generates a consent message for ICRC-21 canister calls
/// This follows the specification from https://github.com/dfinity/wg-identity-authentication/blob/main/topics/ICRC-21/icrc_21_consent_msg.md
#[query]
pub fn icrc21_canister_call_consent_message(request: ICRC21ConsentMessageRequest) -> ICRC21ConsentMessageResponse {
    let caller_principal = caller();
    let consent_message = format!(
        "By signing this message, I confirm that I want to call the '{}' method on the '{}' canister on behalf of principal '{}'.",
        request.method, request.canister, caller_principal
    );

    ICRC21ConsentMessageResponse { consent_message }
}

/// Returns current delegations for the caller that match the requested targets
#[query]
pub fn icrc_34_get_delegation(request: DelegationRequest) -> Result<DelegationResponse, DelegationError> {
    request.validate()?;

    let caller_principal = caller();
    let targets_hash = request.compute_targets_hash();

    let delegations = DELEGATIONS.with(|store| {
        store
            .borrow()
            .get(&caller_principal)
            .map(|d| d.as_vec().clone())
            .unwrap_or_default()
            .into_iter()
            .filter(|d| !d.is_expired() && d.targets_list_hash == targets_hash)
            .collect::<Vec<_>>()
    });

    Ok(DelegationResponse { delegations })
}

/// Creates a new delegation for the specified targets
#[update]
pub fn icrc_34_delegate(request: DelegationRequest) -> Result<DelegationResponse, DelegationError> {
    request.validate()?;

    let caller_principal = caller();
    let current_time = get_current_time();
    let targets_hash = request.compute_targets_hash();

    let delegation = Delegation {
        target: caller_principal,
        created: current_time,
        expiration: request.expiration,
        targets_list_hash: targets_hash,
    };

    DELEGATIONS.with(|store| {
        let mut store = store.borrow_mut();
        let mut user_delegations = store.get(&caller_principal).unwrap_or_default();

        // Remove expired delegations
        user_delegations.retain(|d| !d.is_expired());

        // Add new delegation
        user_delegations.push(delegation.clone());

        store.insert(caller_principal, user_delegations);
        Ok(DelegationResponse {
            delegations: vec![delegation],
        })
    })
}

/// Revokes delegations for the specified targets
#[update]
pub fn icrc_34_revoke_delegation(request: RevokeDelegationRequest) -> Result<(), DelegationError> {
    if request.targets.is_empty() {
        return Err(DelegationError::InvalidRequest("No targets specified".to_string()));
    }

    let caller_principal = caller();
    let targets_hash = {
        let mut targets = request.targets;
        targets.sort();
        hash_principals(&targets)
    };

    DELEGATIONS.with(|store| {
        let mut store = store.borrow_mut();
        let mut user_delegations = store.get(&caller_principal).unwrap_or_default();

        // Remove delegations with matching hash
        user_delegations.retain(|d| d.targets_list_hash != targets_hash);

        store.insert(caller_principal, user_delegations);
        Ok(())
    })
}

#[derive(CandidType, Clone, Debug, Deserialize)]
pub struct Icrc28TrustedOriginsResponse {
    pub trusted_origins: Vec<String>,
}

// list every base URL that users will authenticate to your app from
#[query]
fn icrc28_trusted_origins() -> Icrc28TrustedOriginsResponse {
    let trusted_origins = vec![
        format!("https://edoy4-liaaa-aaaar-qakha-cai.localhost:5173"), // svelte FE
        format!("http://localhost:5173"),
        String::from("https://kongswap.io"),
        String::from("https://www.kongswap.io"),
        String::from("https://edoy4-liaaa-aaaar-qakha-cai.icp0.io"),
        String::from("https://dev.kongswap.io"),
    ];

    Icrc28TrustedOriginsResponse { trusted_origins }
}
