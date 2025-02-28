use candid::Principal;
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;

#[derive(Debug, Serialize, Deserialize, Clone, candid::CandidType)]
pub struct AdminInfo {
    pub principal_id: Principal,
}

impl Storable for AdminInfo {
    fn to_bytes(&self) -> Cow<[u8]> {
        let encoded = candid::encode_one(self).unwrap();
        Cow::Owned(encoded)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        candid::decode_one(&bytes).unwrap()
    }

    const BOUND: ic_stable_structures::storable::Bound = Bound::Unbounded;
}
