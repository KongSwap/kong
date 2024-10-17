use candid::{CandidType, Decode, Deserialize, Encode};
use ic_stable_structures::{storable::Bound, Storable};
use serde::Serialize;
use std::borrow::Cow;

use super::user_map::ANONYMOUS_USER_ID;

use crate::canister::id::caller_principal_id;
use crate::canister::management::get_time;

const USER_ID_SIZE: u32 = std::mem::size_of::<u32>() as u32;

#[derive(PartialEq, Eq, PartialOrd, Ord, Clone, Debug, Serialize, Deserialize)]
pub struct StableUserId(pub u32);

impl Storable for StableUserId {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        self.0.to_bytes() // u64 is already Storable
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Self(u32::from_bytes(bytes))
    }

    // u32 is fixed size
    const BOUND: Bound = Bound::Bounded {
        max_size: USER_ID_SIZE,
        is_fixed_size: true,
    };
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct StableUser {
    pub user_id: u32,
    pub principal_id: String,
    pub user_name: [u16; 3],
    pub my_referral_code: String,
    pub referred_by: Option<u32>, // user_id of the user who referred this user
    pub referred_by_expires_at: Option<u64>,
    // fee level for the user. user's pays lp_fee = 100 - fee_level / 100
    // so 0 = no discount, 100 = pays no lp_fee on swaps
    pub fee_level: u8,
    pub fee_level_expires_at: Option<u64>,
    // campaign1 flags
    // 0: first login
    // 1: first trade
    pub campaign1_flags: Vec<bool>,
    pub last_login_ts: u64,
    pub last_swap_ts: u64,
}

impl Default for StableUser {
    fn default() -> Self {
        StableUser {
            user_id: ANONYMOUS_USER_ID,
            principal_id: caller_principal_id(),
            user_name: [0; 3],
            my_referral_code: "".to_string(),
            referred_by: None,
            referred_by_expires_at: None,
            fee_level: 0,
            fee_level_expires_at: None,
            campaign1_flags: vec![false, false],
            last_login_ts: get_time(),
            last_swap_ts: 0,
        }
    }
}

impl Storable for StableUser {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    // unbounded size
    const BOUND: Bound = Bound::Unbounded;
}