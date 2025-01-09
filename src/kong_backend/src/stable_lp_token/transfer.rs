use candid::Nat;

use super::lp_token_map;
use super::lp_token_map::{get_by_token_id_by_user_id, insert, update};
use super::stable_lp_token::StableLPToken;

use crate::helpers::nat_helpers::{nat_add, nat_subtract};
use crate::ic::get_time::get_time;

/// transfer LP token from caller to another user
///
/// # Arguments
/// token_id - token_id of the LP token
/// to_user_id - user_id of the user to transfer LP token to
/// amount - amount of LP token to transfer
///
/// # Returns
/// StableLPToken - updated LP token of the caller
/// Err - if LP token not found or not enough LP token
pub fn transfer(token_id: u32, to_user_id: u32, amount: &Nat) -> Result<StableLPToken, String> {
    let ts = get_time();

    let from_user = match lp_token_map::get_by_token_id(token_id) {
        Some(from_user_lp_token) => {
            if from_user_lp_token.amount < *amount {
                return Err("Not enough LP token".to_string());
            }
            let amount = nat_subtract(&from_user_lp_token.amount, amount).ok_or("Error calculating new user balance")?;
            StableLPToken {
                amount,
                ts,
                ..from_user_lp_token
            }
        }
        None => return Err("Not enough LP token".to_string()),
    };
    update(&from_user);

    // get user's LP token balance if already exists or create new
    if let Some(to_user_lp_token) = get_by_token_id_by_user_id(token_id, to_user_id) {
        update(&StableLPToken {
            amount: nat_add(&to_user_lp_token.amount, amount),
            ts,
            ..to_user_lp_token
        });
    } else {
        insert(&StableLPToken::new(to_user_id, token_id, amount.clone(), ts))?;
    }

    Ok(from_user)
}
