use candid::{CandidType, Decode, Deserialize, Encode};
use ic_stable_structures::{storable::Bound, Storable};
use serde::Serialize;
use std::borrow::Cow;

const USER_ID_SIZE: u32 = 256; // 64 characters * 4 bytes per character = 256 bytes
const USER_VALUE_SIZE: u32 = 32;

#[derive(PartialEq, Eq, PartialOrd, Ord, Clone, Serialize)]
pub struct StableUserId(pub String);

impl Storable for StableUserId {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        self.0.to_bytes() // String is already Storable
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Self(String::from_bytes(bytes))
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: USER_ID_SIZE,
        is_fixed_size: false,
    };
}

#[derive(CandidType, Default, Clone, Deserialize, Serialize)]
pub struct StableUser {
    pub last_claimed_at: u64,
}

impl Storable for StableUser {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: USER_VALUE_SIZE,
        is_fixed_size: false,
    };
}
