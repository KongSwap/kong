use ic_cdk::query;

use super::admin::*;

use crate::nat::*;
use crate::stable_memory::*;

/// Gets the accumulated fee balance and admin principal
#[query(hidden = true)]
pub fn get_fee_balance() -> Result<StorableNat, String> {
    let user = ic_cdk::api::caller();
    if !is_admin(user) {
        return Err("Only admins can get_fee_balance".to_string());
    }

    let canister_id = ic_cdk::api::id();
    Ok(FEE_BALANCE.with(|balance| StorableNat::from(balance.borrow().get(&canister_id).unwrap_or_default())))
}
