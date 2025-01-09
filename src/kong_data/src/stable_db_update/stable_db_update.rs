use candid::CandidType;
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};

use crate::stable_claim::stable_claim::StableClaim;
use crate::stable_kong_settings::stable_kong_settings::StableKongSettings;
use crate::stable_lp_token::stable_lp_token::StableLPToken;
use crate::stable_pool::stable_pool::StablePool;
use crate::stable_request::stable_request::StableRequest;
use crate::stable_token::stable_token::StableToken;
use crate::stable_transfer::stable_transfer::StableTransfer;
use crate::stable_tx::stable_tx::StableTx;
use crate::stable_user::stable_user::StableUser;

#[derive(CandidType, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct StableDBUpdateId(pub u64);

impl Storable for StableDBUpdateId {
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
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct StableDBUpdate {
    pub db_update_id: u64,
    pub stable_memory: StableMemory,
    pub ts: u64,
}

impl Storable for StableDBUpdate {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}
