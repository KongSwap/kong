use ic_cdk::query;
use kong_lib::stable_lp_token_ledger::stable_lp_token_ledger::StableLPTokenLedgerId;
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::LP_TOKEN_LEDGER;

const MAX_LP_TOKEN_LEDGER: usize = 1_000;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_lp_token_ledger(lp_token_id: Option<u64>, num_lp_token_ledger: Option<u16>) -> Result<String, String> {
    LP_TOKEN_LEDGER.with(|m| {
        let map = m.borrow();
        let lp_tokens: BTreeMap<_, _> = match lp_token_id {
            Some(lp_token_id) => {
                let num_lp_token_ledger = num_lp_token_ledger.map_or(1, |n| n as usize);
                let start_key = StableLPTokenLedgerId(lp_token_id);
                map.range(start_key..).take(num_lp_token_ledger).collect()
            }
            None => {
                let num_lp_token_ledger = num_lp_token_ledger.map_or(MAX_LP_TOKEN_LEDGER, |n| n as usize);
                map.iter().take(num_lp_token_ledger).collect()
            }
        };
        serde_json::to_string(&lp_tokens).map_err(|e| format!("Failed to serialize LP tokens: {}", e))
    })
}
