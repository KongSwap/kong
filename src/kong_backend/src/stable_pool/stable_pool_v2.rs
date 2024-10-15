use candid::{CandidType, Decode, Deserialize, Encode, Nat};
use ic_stable_structures::{storable::Bound, Storable};
use serde::Serialize;
use std::borrow::Cow;

use super::stable_pool::StablePool;

use crate::helpers::nat_helpers::nat_zero;

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct StablePoolV2 {
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

impl StablePoolV2 {
    pub fn from_stable_pool(pool: StablePool) -> Self {
        StablePoolV2 {
            pool_id: pool.pool_id,
            token_id_0: pool.token_id_0,
            balance_0: pool.balance_0,
            lp_fee_0: pool.lp_fee_0,
            kong_fee_0: pool.kong_fee_0,
            token_id_1: pool.token_id_1,
            balance_1: pool.balance_1,
            lp_fee_1: pool.lp_fee_1,
            kong_fee_1: pool.kong_fee_1,
            lp_fee_bps: pool.lp_fee_bps,
            kong_fee_bps: pool.kong_fee_bps,
            lp_token_id: pool.lp_token_id,
            on_kong: pool.on_kong,
            rolling_24h_volume: nat_zero(),
            rolling_24h_lp_fee: nat_zero(),
            rolling_24h_num_swaps: nat_zero(),
            rolling_24h_apy: 0_f64,
            total_volume: pool.total_volume,
            total_lp_fee: pool.total_lp_fee.clone(),
        }
    }

    pub fn to_stable_pool(&self) -> StablePool {
        StablePool {
            pool_id: self.pool_id,
            token_id_0: self.token_id_0,
            balance_0: self.balance_0.clone(),
            lp_fee_0: self.lp_fee_0.clone(),
            kong_fee_0: self.kong_fee_0.clone(),
            token_id_1: self.token_id_1,
            balance_1: self.balance_1.clone(),
            lp_fee_1: self.lp_fee_1.clone(),
            kong_fee_1: self.kong_fee_1.clone(),
            lp_fee_bps: self.lp_fee_bps,
            kong_fee_bps: self.kong_fee_bps,
            lp_token_id: self.lp_token_id,
            on_kong: self.on_kong,
            rolling_24h_volume: self.rolling_24h_volume.clone(),
            rolling_24h_lp_fee: self.rolling_24h_lp_fee.clone(),
            rolling_24h_num_swaps: self.rolling_24h_num_swaps.clone(),
            rolling_24h_apy: self.rolling_24h_apy,
            total_volume: self.total_volume.clone(),
            total_lp_fee: self.total_lp_fee.clone(),
        }
    }
}

impl Storable for StablePoolV2 {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        Cow::Owned(Encode!(self).unwrap())
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        Decode!(bytes.as_ref(), Self).unwrap()
    }

    // unbounded size
    const BOUND: Bound = Bound::Unbounded;
}
