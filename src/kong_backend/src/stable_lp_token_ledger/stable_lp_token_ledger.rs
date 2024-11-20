use candid::{CandidType, Nat};
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};

use super::stable_lp_token_ledger_old::{StableLPTokenLedgerIdOld, StableLPTokenLedgerOld};

#[derive(CandidType, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct StableLPTokenLedgerId(pub u64);

impl StableLPTokenLedgerId {
    pub fn from_old(stable_lp_token_ledger_id: &StableLPTokenLedgerIdOld) -> Self {
        let lp_token_ledger_id_old = serde_json::to_value(stable_lp_token_ledger_id).unwrap();
        serde_json::from_value(lp_token_ledger_id_old).unwrap()
    }
}

impl Storable for StableLPTokenLedgerId {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct StableLPTokenLedger {
    pub lp_token_id: u64, // unique id (same as StableLPTokenLedgerId) for LP_TOKEN_LEDGER
    pub user_id: u32,     // user id of the token holder
    pub token_id: u32,    // token id of the token
    pub amount: Nat,      // amount the user holds of the token
    pub ts: u64,          // timestamp of the last token update
}

impl StableLPTokenLedger {
    pub fn from_old(stable_lp_token_ledger: &StableLPTokenLedgerOld) -> Self {
        let lp_token_ledger_old = serde_json::to_value(stable_lp_token_ledger).unwrap();
        serde_json::from_value(lp_token_ledger_old).unwrap()
    }
}

impl Storable for StableLPTokenLedger {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}
