use super::stable_claim::{ClaimStatus, StableClaim, StableClaimId};

use crate::helpers::nat_helpers::{nat_is_zero, nat_subtract, nat_zero};
use crate::ic::logging::error_log;
use crate::stable_kong_settings::kong_settings_map;
use crate::stable_memory::CLAIM_MAP;
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::token::Token;
use crate::stable_token::token_map;

pub fn get_by_claim_id(claim_id: u64) -> Option<StableClaim> {
    CLAIM_MAP.with(|m| m.borrow().get(&StableClaimId(claim_id)))
}

pub fn get_token(claim: &StableClaim) -> StableToken {
    token_map::get_by_token_id(claim.token_id).unwrap()
}

pub fn insert(claim: &StableClaim, token: &StableToken) -> Result<u64, String> {
    let amount_with_gas = nat_subtract(&claim.amount, &token.fee()).unwrap_or(nat_zero());
    if nat_is_zero(&amount_with_gas) {
        Err("Claim amount is zero".to_string())?
    }

    CLAIM_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let claim_id = kong_settings_map::inc_claim_map_idx();
        let insert_claim = StableClaim { claim_id, ..claim.clone() };
        map.insert(StableClaimId(claim_id), insert_claim);
        Ok(claim_id)
    })
}

pub fn add_attempt_request_id(claim_id: u64, request_id: u64) -> Option<StableClaim> {
    CLAIM_MAP.with(|m| {
        let mut map = m.borrow_mut();
        match map.get(&StableClaimId(claim_id)) {
            Some(mut v) => {
                v.attempt_request_id.push(request_id);
                map.insert(StableClaimId(claim_id), v.clone());
                Some(v)
            }
            None => None,
        }
    })
}

pub fn update_status(claim_id: u64, status: ClaimStatus) -> Option<StableClaim> {
    CLAIM_MAP.with(|m| {
        let mut map = m.borrow_mut();
        match map.get(&StableClaimId(claim_id)) {
            Some(mut v) => {
                v.status = status;
                map.insert(StableClaimId(claim_id), v.clone());
                Some(v)
            }
            None => None,
        }
    })
}

// used for setting the status of a claim to claiming to prevent reentrancy
pub fn update_claiming_status(claim_id: u64) -> Option<StableClaim> {
    update_status(claim_id, ClaimStatus::Claiming)
}

pub fn update_too_many_attempts_status(claim_id: u64) -> Option<StableClaim> {
    update_status(claim_id, ClaimStatus::TooManyAttempts)
}

// used for setting the status of a claim to claimed after a successful claim
pub fn update_claimed_status(claim_id: u64, request_id: u64, transfer_id: u64) -> Option<StableClaim> {
    CLAIM_MAP.with(|m| {
        let mut map = m.borrow_mut();
        match map.get(&StableClaimId(claim_id)) {
            Some(mut v) => {
                v.status = ClaimStatus::Claimed;
                v.attempt_request_id.push(request_id);
                v.transfer_ids.push(transfer_id);
                map.insert(StableClaimId(claim_id), v.clone());
                Some(v)
            }
            None => None,
        }
    })
}

// used for reverting back a claim to unclaimed status when a claim fails
pub fn update_unclaimed_status(claim_id: u64, request_id: u64) -> Option<StableClaim> {
    add_attempt_request_id(claim_id, request_id);
    update_status(claim_id, ClaimStatus::Unclaimed)
}

pub fn archive_to_kong_data(claim_id: u64) -> Result<(), String> {
    if !kong_settings_map::get().archive_to_kong_data {
        return Ok(());
    }

    let claim = match get_by_claim_id(claim_id) {
        Some(claim) => claim,
        None => Err(format!("Failed to archive. claim_id #{} not found", claim_id))?,
    };
    let claim_json = match serde_json::to_string(&claim) {
        Ok(claim_json) => claim_json,
        Err(e) => Err(format!("Failed to archive claim_id #{}. {}", claim_id, e))?,
    };

    ic_cdk::spawn(async move {
        let kong_data = kong_settings_map::get().kong_data;
        match ic_cdk::call::<(String,), (Result<String, String>,)>(kong_data, "update_claim", (claim_json,))
            .await
            .map_err(|e| e.1)
            .unwrap_or_else(|e| (Err(e),))
            .0
        {
            Ok(_) => (),
            Err(e) => error_log(&format!("Failed to archive claim_id #{}. {}", claim_id, e)),
        }
    });

    Ok(())
}
