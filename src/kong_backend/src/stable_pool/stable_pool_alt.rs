use candid::{CandidType, Nat};
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};

use super::stable_pool::{StablePool, StablePoolId};

#[derive(CandidType, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct StablePoolIdAlt(pub u32);

impl StablePoolIdAlt {
    pub fn from_stable_pool_id(stable_pool_id: &StablePoolId) -> Self {
        let pool_id_alt = serde_json::to_value(stable_pool_id).unwrap();
        serde_json::from_value(pool_id_alt).unwrap()
    }
}

impl Storable for StablePoolIdAlt {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct StablePoolAlt {
    pub pool_id: u32,
    pub token_id_0: u32,
    pub balance_0: Nat,
    pub lp_fee_0: Nat,
    pub kong_fee_0: Nat, // Kong's share of the LP fee
    pub token_id_1: u32,
    pub balance_1: Nat,
    pub lp_fee_1: Nat,
    pub kong_fee_1: Nat,  // Kong's share of the LP fee
    pub lp_fee_bps: u8,   // LP's fee in basis points
    pub kong_fee_bps: u8, // Kong's fee in basis points
    pub lp_token_id: u32, // token id of the LP token
    pub on_kong: bool,    // whether the pool is on Kong
    pub rolling_24h_volume: Nat,
    pub rolling_24h_lp_fee: Nat,
    pub rolling_24h_num_swaps: Nat,
    pub rolling_24h_apy: f64,
    pub total_volume: Nat, // lifetime volume of the pool in token_1
    pub total_lp_fee: Nat, // lifetime LP fee of the pool in token_1
}

impl StablePoolAlt {
    pub fn from_stable_pool(stable_pool: &StablePool) -> Self {
        let pool_alt = serde_json::to_value(stable_pool).unwrap();
        serde_json::from_value(pool_alt).unwrap()
    }
}

impl Storable for StablePoolAlt {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}
