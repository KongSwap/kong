use super::stable_claim::{ClaimStatus, StableClaim, StableClaimId};

use crate::stable_kong_settings::kong_settings_map;
use crate::stable_memory::CLAIM_MAP;
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::token_map;

/// get the number of unclaimed claims
pub fn get_num_unclaimed_claims() -> u64 {
    CLAIM_MAP.with(|m| m.borrow().iter().filter(|(_, v)| v.status == ClaimStatus::Unclaimed).count() as u64)
}

pub fn get_token(claim: &StableClaim) -> StableToken {
    token_map::get_by_token_id(claim.token_id).unwrap()
}

pub fn insert(claim: &StableClaim) -> Result<u64, String> {
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

fn update_status(claim_id: u64, status: ClaimStatus) -> Option<StableClaim> {
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

// used for reverting back a claim to unclaimed status when a claim fails
pub fn update_unclaimed_status(claim_id: u64) -> Option<StableClaim> {
    update_status(claim_id, ClaimStatus::Unclaimed)
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
