use ic_cdk::query;
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_lp_token_ledger::stable_lp_token_ledger::StableLPTokenLedgerId;
use crate::stable_memory::LP_TOKEN_LEDGER;

const MAX_LP_TOKEN_LEDGER: usize = 1_000;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_lp_token_ledger(lp_token_id: Option<u64>, num_lp_token_ledger: Option<u16>) -> Result<String, String> {
    match lp_token_id {
        Some(lp_token_id) if num_lp_token_ledger.is_none() => LP_TOKEN_LEDGER.with(|m| {
            let key = StableLPTokenLedgerId(lp_token_id);
            serde_json::to_string(&m.borrow().get(&key).map_or_else(
                || Err(format!("LP Token #{} not found", lp_token_id)),
                |v| Ok(BTreeMap::new().insert(key, v)),
            )?)
            .map_err(|e| format!("Failed to serialize lp_tokens: {}", e))
        }),
        Some(lp_token_id) => LP_TOKEN_LEDGER.with(|m| {
            let num_lp_token_ledger = num_lp_token_ledger.map_or(MAX_LP_TOKEN_LEDGER, |n| n as usize);
            let start_key = StableLPTokenLedgerId(lp_token_id);
            serde_json::to_string(
                &m.borrow()
                    .iter()
                    .collect::<BTreeMap<_, _>>()
                    .iter()
                    .rev()
                    .collect::<BTreeMap<_, _>>()
                    .range(start_key..)
                    .take(num_lp_token_ledger)
                    .collect::<BTreeMap<_, _>>(),
            )
            .map_err(|e| format!("Failed to serialize lp_tokens: {}", e))
        }),
        None => LP_TOKEN_LEDGER.with(|m| {
            let num_lp_token_ledger = num_lp_token_ledger.map_or(MAX_LP_TOKEN_LEDGER, |n| n as usize);
            serde_json::to_string(
                &m.borrow()
                    .iter()
                    .collect::<BTreeMap<_, _>>()
                    .iter()
                    .rev()
                    .take(num_lp_token_ledger)
                    .collect::<BTreeMap<_, _>>(),
            )
            .map_err(|e| format!("Failed to serialize lp_tokens: {}", e))
        }),
    }
}
