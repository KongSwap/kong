use candid::CandidType;
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};

use super::ic_token::ICToken;
use super::lp_token::LPToken;

const TOKEN_ID_SIZE: u32 = std::mem::size_of::<u32>() as u32;

#[derive(CandidType, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct StableTokenId(pub u32);

impl Storable for StableTokenId {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        self.0.to_bytes() // u32 is already Storable
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Self(u32::from_bytes(bytes))
    }

    // u32 is fixed size
    const BOUND: Bound = Bound::Bounded {
        max_size: TOKEN_ID_SIZE,
        is_fixed_size: true,
    };
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub enum StableToken {
    LP(LPToken), // LP tokens
    IC(ICToken), // IC tokens
}

impl Storable for StableToken {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    // unbounded size
    const BOUND: Bound = Bound::Unbounded;
}
