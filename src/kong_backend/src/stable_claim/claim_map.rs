use std::cmp::Reverse;

use super::stable_claim::{ClaimStatus, StableClaim, StableClaimId};

use crate::stable_user::user_map;
use crate::CLAIM_MAP;

#[allow(dead_code)]
pub fn get_by_claim_id(claim_id: u64) -> Option<StableClaim> {
    let user_id = user_map::get_by_caller().ok().flatten()?.user_id;
    CLAIM_MAP.with(|m| {
        m.borrow().iter().find_map(|(k, v)| {
            // only unclaimed claims of caller
            if k.0 == claim_id && (user_id == v.user_id) && (v.status == ClaimStatus::Unclaimed) {
                Some(v)
            } else {
                None
            }
        })
    })
}

/// get the number of unclaimed claims
pub fn get_num_unclaimed_claims() -> u64 {
    CLAIM_MAP.with(|m| {
        m.borrow()
            .iter()
            .filter(|(_, v)| v.status == ClaimStatus::Unclaimed)
            .count() as u64
    })
}

/// get all the unclaimed claims of the caller
#[allow(dead_code)]
pub fn get() -> Vec<StableClaim> {
    let user_id = match user_map::get_by_caller() {
        Ok(Some(caller)) => caller.user_id,
        Ok(None) | Err(_) => return Vec::new(),
    };
    let mut claims: Vec<StableClaim> = CLAIM_MAP.with(|m| {
        m.borrow()
            .iter()
            .filter_map(|(_, v)| {
                // only unclaimed claims of caller
                if user_id == v.user_id && (v.status == ClaimStatus::Unclaimed) {
                    Some(v)
                } else {
                    None
                }
            })
            .collect()
    });
    // order by timestamp in reverse order
    claims.sort_by_key(|claim| Reverse(claim.ts));
    claims
}

pub fn insert(claim: &StableClaim) -> u64 {
    CLAIM_MAP.with(|m| {
        let mut map = m.borrow_mut();
        // with lock, increase claim id key
        let claim_id = map.iter()
            .map(|(k, _)| k.0)
            .max()
            .unwrap_or(0) // only if empty and first claim
            + 1;
        let insert_claim = StableClaim {
            claim_id,
            ..claim.clone()
        };
        map.insert(StableClaimId(claim_id), insert_claim);
        claim_id
    })
}

pub fn insert_attempt_request_id(claim_id: u64, request_id: u64) -> Option<StableClaim> {
    CLAIM_MAP.with(|m| {
        let mut map = m.borrow_mut();
        match map.iter().find(|(k, _)| k.0 == claim_id) {
            Some((k, mut v)) => {
                v.attempt_request_id.push(request_id);
                map.insert(k, v.clone());
                Some(v)
            }
            None => None,
        }
    })
}

// used for reverting back a claim to unclaimed status when a claim fails
pub fn update_unclaimed_status(claim_id: u64) -> Option<StableClaim> {
    CLAIM_MAP.with(|m| {
        let mut map = m.borrow_mut();
        match map.iter().find(|(k, _)| k.0 == claim_id) {
            Some((k, mut v)) => {
                v.status = ClaimStatus::Unclaimed;
                map.insert(k, v.clone());
                Some(v)
            }
            None => None,
        }
    })
}

// used for setting the status of a claim to claiming to prevent reentrancy
pub fn update_claiming_status(claim_id: u64) -> Option<StableClaim> {
    CLAIM_MAP.with(|m| {
        let mut map = m.borrow_mut();
        match map.iter().find(|(k, _)| k.0 == claim_id) {
            Some((k, mut v)) => {
                v.status = ClaimStatus::Claiming;
                map.insert(k, v.clone());
                Some(v)
            }
            None => None,
        }
    })
}

// used for setting the status of a claim to claimed after a successful claim
pub fn update_claimed_status(claim_id: u64, request_id: u64, transfer_id: u64) -> Option<StableClaim> {
    CLAIM_MAP.with(|m| {
        let mut map = m.borrow_mut();
        match map.iter().find(|(k, _)| k.0 == claim_id) {
            Some((k, mut v)) => {
                v.status = ClaimStatus::Claimed;
                v.attempt_request_id.push(request_id);
                v.transfer_ids.push(transfer_id);
                map.insert(k, v.clone());
                Some(v)
            }
            None => None,
        }
    })
}
