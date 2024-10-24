use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_memory::{LP_TOKEN_LEDGER, LP_TOKEN_LEDGER_ARCHIVE};

pub fn archive_lp_token_ledger() {
    if not_in_maintenance_mode().is_err() {
        return;
    }

    // archive lp_token_ledger
    LP_TOKEN_LEDGER.with(|lp_token_ledger_map| {
        for (lp_token_ledger_id, lp_token_ledger) in lp_token_ledger_map.borrow().iter() {
            LP_TOKEN_LEDGER_ARCHIVE.with(|lp_token_ledger_map_tmp| {
                lp_token_ledger_map_tmp.borrow_mut().insert(lp_token_ledger_id, lp_token_ledger);
            });
        }
    });
}
