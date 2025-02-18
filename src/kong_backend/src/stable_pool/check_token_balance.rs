use candid::{CandidType, Int, Nat};
use serde::{Deserialize, Serialize};

use crate::helpers::nat_helpers::nat_add;
use crate::helpers::nat_helpers::nat_zero;
use crate::ic::ledger::get_balance;
use crate::stable_claim::claim_map;
use crate::stable_claim::stable_claim::ClaimStatus;
use crate::stable_kong_settings::kong_settings_map;
use crate::stable_memory::CLAIM_MAP;
use crate::stable_memory::POOL_MAP;
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::token::Token;

#[derive(CandidType, Clone, Deserialize, Serialize)]
pub struct PoolExpectedBalance {
    pub pool_symbol: String,
    pub balance: Nat,
    pub lp_fee: Nat,
    pub kong_fee: Nat,
}

#[derive(CandidType, Clone, Deserialize, Serialize)]
pub struct ExpectedBalance {
    pub balance: Nat,
    pub pool_balances: Vec<PoolExpectedBalance>,
    pub unclaimed_claims: Nat,
}

/// token balance check
/// actual_balance: the actual balance in the backend canister
/// expected_balance: the expected balance stored in stable memory
pub async fn check_token_balance(token: &StableToken) -> Result<(StableToken, Nat, ExpectedBalance, Int), String> {
    let kong_backend = kong_settings_map::get().kong_backend;
    let token_id = token.token_id();

    let actual_balance = get_balance(kong_backend, token.canister_id().ok_or("Principal id not found")?).await?;

    // calculate the expected balance
    let mut expected_balance = ExpectedBalance {
        balance: nat_zero(),
        pool_balances: Vec::new(),
        unclaimed_claims: nat_zero(),
    };
    // iterate over all pools and sum up the balances
    POOL_MAP.with(|m| {
        let map = m.borrow();
        for (_, v) in map.iter() {
            if v.token_0().token_id() == token_id {
                // expected_balance += v.balance_0 + v.lp_fee_0 + v.kong_fee_0;
                expected_balance.balance += nat_add(&nat_add(&v.balance_0, &v.lp_fee_0), &v.kong_fee_0);
                expected_balance.pool_balances.push(PoolExpectedBalance {
                    pool_symbol: v.symbol(),
                    balance: v.balance_0,
                    lp_fee: v.lp_fee_0,
                    kong_fee: v.kong_fee_0,
                })
            } else if v.token_1().token_id() == token_id {
                // expected_balance += v.balance_1 + v.lp_fee_1 + v.kong_fee_1;
                expected_balance.balance += nat_add(&nat_add(&v.balance_1, &v.lp_fee_1), &v.kong_fee_1);
                expected_balance.pool_balances.push(PoolExpectedBalance {
                    pool_symbol: v.symbol(),
                    balance: v.balance_1,
                    lp_fee: v.lp_fee_1,
                    kong_fee: v.kong_fee_1,
                })
            }
        }
    });
    // add unclaimed claims back to balances
    CLAIM_MAP.with(|m| {
        let map = m.borrow();
        for (_, v) in map.iter() {
            if claim_map::get_token(&v).token_id() == token_id && v.status == ClaimStatus::Unclaimed {
                expected_balance.unclaimed_claims += v.amount
            }
        }
    });

    let actual_balance_int = Int::from(actual_balance.clone());
    let expected_balance_int = Int::from(expected_balance.balance.clone());
    let difference = actual_balance_int - expected_balance_int;

    Ok((token.clone(), actual_balance, expected_balance, difference))
}
