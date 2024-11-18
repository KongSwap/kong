use candid::CandidType;
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};

use super::ic_token::ICToken;
use super::lp_token::LPToken;
use super::stable_token::{StableToken, StableTokenId};

#[derive(CandidType, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct StableTokenIdAlt(pub u32);

impl StableTokenIdAlt {
    pub fn from_stable_token_id(stable_token_id: &StableTokenId) -> Self {
        let token_id_alt = serde_json::to_value(stable_token_id).unwrap();
        serde_json::from_value(token_id_alt).unwrap()
    }

    pub fn to_stable_token_id(&self) -> StableTokenId {
        let token_id_alt = serde_json::to_value(self).unwrap();
        serde_json::from_value(token_id_alt).unwrap()
    }
}

impl Storable for StableTokenIdAlt {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub enum StableTokenAlt {
    LP(LPToken), // LP tokens
    IC(ICToken), // IC tokens
}

impl StableTokenAlt {
    pub fn from_stable_token(stable_token: &StableToken) -> Self {
        let token_alt = serde_json::to_value(stable_token).unwrap();
        serde_json::from_value(token_alt).unwrap()
    }

    pub fn to_stable_token(&self) -> StableToken {
        let token_alt = serde_json::to_value(self).unwrap();
        serde_json::from_value(token_alt).unwrap()
    }
}

impl Storable for StableTokenAlt {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}
