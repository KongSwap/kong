use candid::Nat;

use super::stable_lp_token_ledger::StableLPTokenLedger;

impl StableLPTokenLedger {
    pub fn new(user_id: u32, token_id: u32, amount: Nat, ts: u64) -> Self {
        Self {
            lp_token_id: 0,
            user_id,
            token_id,
            amount,
            ts,
        }
    }
}
