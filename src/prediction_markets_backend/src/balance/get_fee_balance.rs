use ic_cdk::query;

use super::balance::*;

use crate::nat::*;
use crate::stable_memory::*;

/// Gets the accumulated fee balance and admin principal
#[query]
pub fn get_fee_balance() -> GetFeeBalanceResult {
    let canister_id = ic_cdk::api::id();

    GetFeeBalanceResult {
        admin_principal: canister_id,
        balance: FEE_BALANCE.with(|balance| StorableNat::from(balance.borrow().get(&canister_id).unwrap_or_default())),
    }
}
