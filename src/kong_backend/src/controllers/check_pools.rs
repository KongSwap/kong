use candid::{CandidType, Int, Nat};
use futures::future::join_all;
use ic_cdk::update;
use serde::{Deserialize, Serialize};

use crate::ic::guards::caller_is_kingkong;
use crate::stable_pool::check_token_balance::{check_token_balance, ExpectedBalance};
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::stable_token::StableToken::{IC, LP, Solana};
use crate::stable_token::token::Token;
use crate::stable_token::token_map;

#[derive(CandidType, Clone, Deserialize, Serialize)]
pub struct CheckPoolReply {
    pub symbol: String,
    pub actual_balance: Nat,
    pub expected_balance: ExpectedBalance,
    pub diff_balance: Int,
}

fn to_check_pool_reply(
    token: &StableToken,
    actual_balance: &Nat,
    expected_balance: &ExpectedBalance,
    diff_balance: &Int,
) -> Option<CheckPoolReply> {
    Some(CheckPoolReply {
        symbol: token.symbol().to_string(),
        actual_balance: actual_balance.clone(),
        expected_balance: expected_balance.clone(),
        diff_balance: diff_balance.clone(),
    })
}

/// check integrity of the pools. compare the expected balances stored in stable memory versus the actual balances in the canister.
/// maybe not be 100% accurate if in use as canister balances can change
///
/// # Returns
/// for each token, the actual, expected, and difference in balances
#[update(hidden = true, guard = "caller_is_kingkong")]
async fn check_pools() -> Result<Vec<CheckPoolReply>, String> {
    let tokens = token_map::get();
    // for each token, get the actual, expected, and difference in balances asynchonously
    let futures = tokens
        .iter()
        .filter_map(|token| match token {
            LP(_) => None, // pools for LP tokens are not supported
            IC(_) => Some(check_token_balance(token)),
            Solana(_) => None, // Solana token balance checks not yet implemented
        })
        .collect::<Vec<_>>();
    let results = join_all(futures).await;

    let pools = results
        .iter()
        .filter_map(|result| match result {
            Ok((token, actual_balance, expected_balance, diff_balance)) => {
                to_check_pool_reply(token, actual_balance, expected_balance, diff_balance)
            }
            Err(_) => None,
        })
        .collect();
    Ok(pools)
}
