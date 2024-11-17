use candid::{CandidType, Nat};
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};

use super::stable_lp_token_ledger::{StableLPTokenLedger, StableLPTokenLedgerId};

#[derive(CandidType, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct StableLPTokenLedgerIdAlt(pub u64);

impl StableLPTokenLedgerIdAlt {
    pub fn from_stable_lp_token_ledger_id(stable_lp_token_ledger_id: &StableLPTokenLedgerId) -> Self {
        let lp_token_ledger_id_alt = serde_json::to_value(stable_lp_token_ledger_id).unwrap();
        serde_json::from_value(lp_token_ledger_id_alt).unwrap()
    }
}

impl Storable for StableLPTokenLedgerIdAlt {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct StableLPTokenLedgerAlt {
    pub lp_token_id: u64, // unique id (same as StableLPTokenLedgerId) for LP_TOKEN_LEDGER
    pub user_id: u32,     // user id of the token holder
    pub token_id: u32,    // token id of the token
    pub amount: Nat,      // amount the user holds of the token
    pub ts: u64,          // timestamp of the last token update
}

impl StableLPTokenLedgerAlt {
    pub fn from_stable_lp_token_ledger(stable_lp_token_ledger: &StableLPTokenLedger) -> Self {
        let lp_token_ledger_alt = serde_json::to_value(stable_lp_token_ledger).unwrap();
        serde_json::from_value(lp_token_ledger_alt).unwrap()
    }
}

impl Storable for StableLPTokenLedgerAlt {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}
