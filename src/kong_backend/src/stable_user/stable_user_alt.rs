use crate::ic::get_time::get_time;
use crate::ic::id::caller_principal_id;
use candid::CandidType;
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};

use super::stable_user::{StableUser, StableUserId};

// reserved user ids
// 0: all users - users for stable_messages to broadcast to all users
// 1: system - system user
// 2: claims timer - user id to identify claim was made by system timer
// 3-99: reserved for future use
// 100-: user ids
pub const ANONYMOUS_USER_ID: u32 = 0;
#[allow(dead_code)]
pub const ALL_USERS_USER_ID: u32 = 1;
#[allow(dead_code)]
pub const SYSTEM_USER_ID: u32 = 2;
#[allow(dead_code)]
pub const CLAIMS_TIMER_USER_ID: u32 = 3;

#[derive(CandidType, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct StableUserIdAlt(pub u32);

impl StableUserIdAlt {
    pub fn from_stable_user_id(stable_user_id: &StableUserId) -> Self {
        let user_id_alt = serde_json::to_value(stable_user_id).unwrap();
        serde_json::from_value(user_id_alt).unwrap()
    }

    pub fn to_stable_user_id(&self) -> StableUserId {
        let user_id_alt = serde_json::to_value(self).unwrap();
        serde_json::from_value(user_id_alt).unwrap()
    }
}

impl Storable for StableUserIdAlt {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct StableUserAlt {
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

impl StableUserAlt {
    pub fn from_stable_user(stable_user: &StableUser) -> Self {
        let user_alt = serde_json::to_value(stable_user).unwrap();
        serde_json::from_value(user_alt).unwrap()
    }

    pub fn to_stable_user(&self) -> StableUser {
        let user_alt = serde_json::to_value(self).unwrap();
        serde_json::from_value(user_alt).unwrap()
    }
}

impl Default for StableUserAlt {
    fn default() -> Self {
        StableUserAlt {
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

impl Storable for StableUserAlt {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}