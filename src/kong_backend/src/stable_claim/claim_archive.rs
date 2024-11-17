use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_memory::{CLAIM_ARCHIVE_MAP, CLAIM_MAP};

pub fn archive_claim_map() {
    if not_in_maintenance_mode().is_err() {
        return;
    }

    // archive claims
    CLAIM_MAP.with(|claim_map| {
        for (claim_id, claim) in claim_map.borrow().iter() {
            CLAIM_ARCHIVE_MAP.with(|claim_archive_map| {
                claim_archive_map.borrow_mut().insert(claim_id, claim);
            });
        }
    });
}
