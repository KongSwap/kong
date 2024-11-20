use candid::CandidType;
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};

use super::ic_token::ICToken;
use super::lp_token::LPToken;
use super::stable_token_old::{StableTokenIdOld, StableTokenOld};

#[derive(CandidType, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct StableTokenId(pub u32);

impl StableTokenId {
    pub fn from_old(stable_token_id: &StableTokenIdOld) -> Self {
        let token_id_old = serde_json::to_value(stable_token_id).unwrap();
        serde_json::from_value(token_id_old).unwrap()
    }
}

impl Storable for StableTokenId {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub enum StableToken {
    LP(LPToken), // LP tokens
    IC(ICToken), // IC tokens
}

impl StableToken {
    pub fn from_old(stable_token: &StableTokenOld) -> Self {
        let token_old = serde_json::to_value(stable_token).unwrap();
        serde_json::from_value(token_old).unwrap()
    }
}

impl Storable for StableToken {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}
