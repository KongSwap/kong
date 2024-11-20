use candid::{CandidType, Decode, Encode};
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;

use super::ic_token::ICToken;
use super::lp_token::LPToken;

const TOKEN_ID_SIZE: u32 = std::mem::size_of::<u32>() as u32;

#[derive(CandidType, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct StableTokenIdOld(pub u32);

impl Storable for StableTokenIdOld {
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
pub enum StableTokenOld {
    LP(LPToken), // LP tokens
    IC(ICToken), // IC tokens
}

impl Storable for StableTokenOld {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    // unbounded size
    const BOUND: Bound = Bound::Unbounded;
}
