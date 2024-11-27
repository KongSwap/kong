use super::stable_claim::{ClaimStatus, StableClaim, StableClaimId};

use crate::stable_kong_settings::kong_settings;
use crate::stable_memory::CLAIM_MAP;
use crate::stable_user::user_map;

#[allow(dead_code)]
pub fn get_by_claim_id(claim_id: u64) -> Option<StableClaim> {
    let user_id = user_map::get_by_caller().ok().flatten()?.user_id;
    CLAIM_MAP.with(|m| {
        m.borrow().get(&StableClaimId(claim_id)).and_then(|v| {
            // only unclaimed claims of caller
            if user_id == v.user_id && (v.status == ClaimStatus::Unclaimed) {
                return Some(v);
            }
            None
        })
    })
}

/// get the number of unclaimed claims
pub fn get_num_unclaimed_claims() -> u64 {
    CLAIM_MAP.with(|m| m.borrow().iter().filter(|(_, v)| v.status == ClaimStatus::Unclaimed).count() as u64)
}

/// get all the unclaimed claims of the caller
#[allow(dead_code)]
pub fn get() -> Vec<StableClaim> {
    let user_id = match user_map::get_by_caller() {
        Ok(Some(caller)) => caller.user_id,
        Ok(None) | Err(_) => return Vec::new(),
    };
    CLAIM_MAP.with(|m| {
        m.borrow()
            .iter()
            .rev()
            .filter_map(|(_, v)| {
                // only unclaimed claims of caller
                if user_id == v.user_id && (v.status == ClaimStatus::Unclaimed) {
                    return Some(v.clone());
                }
                None
            })
            .collect()
    })
}

pub fn insert(claim: &StableClaim) -> u64 {
    CLAIM_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let claim_id = kong_settings::inc_claim_map_idx();
        let insert_claim = StableClaim { claim_id, ..claim.clone() };
        map.insert(StableClaimId(claim_id), insert_claim);
        claim_id
    })
}

pub fn insert_attempt_request_id(claim_id: u64, request_id: u64) -> Option<StableClaim> {
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
