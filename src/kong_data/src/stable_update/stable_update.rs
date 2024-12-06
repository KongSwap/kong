use candid::CandidType;
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};

use crate::{
    stable_claim::stable_claim::StableClaim, stable_kong_settings::stable_kong_settings::StableKongSettings,
    stable_lp_token::stable_lp_token::StableLPToken, stable_message::stable_message::StableMessage, stable_pool::stable_pool::StablePool,
    stable_request::stable_request::StableRequest, stable_token::stable_token::StableToken,
    stable_transfer::stable_transfer::StableTransfer, stable_tx::stable_tx::StableTx, stable_user::stable_user::StableUser,
};

#[derive(CandidType, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct StableUpdateId(pub u64);

impl Storable for StableUpdateId {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub enum StableMemory {
    KongSettings(StableKongSettings),
    UserMap(StableUser),
    TokenMap(StableToken),
    PoolMap(StablePool),
    TxMap(StableTx),
    RequestMap(StableRequest),
    TransferMap(StableTransfer),
    ClaimMap(StableClaim),
    LPTokenMap(StableLPToken),
    MessageMap(StableMessage),
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct StableUpdate {
    pub update_id: u64,
    pub stable_memory: StableMemory,
    pub ts: u64,
}

impl Storable for StableUpdate {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}
