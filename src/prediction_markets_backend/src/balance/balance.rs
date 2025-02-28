use candid::{CandidType, Principal};

use crate::nat::*;

#[derive(CandidType)]
pub struct GetFeeBalanceResult {
    pub admin_principal: Principal,
    pub balance: StorableNat,
}
