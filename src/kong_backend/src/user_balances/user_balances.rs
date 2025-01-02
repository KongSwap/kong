use ic_cdk::query;

use super::lp_reply::LPReply;
use super::user_balances_reply::UserBalancesReply;

use crate::helpers::nat_helpers::{nat_add, nat_divide, nat_multiply, nat_to_decimals_f64, nat_zero};
use crate::ic::ckusdt::{ckusdt_amount, to_ckusdt_decimals_f64};
use crate::ic::get_time::get_time;
use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_lp_token::lp_token_map;
use crate::stable_token::lp_token::LPToken;
use crate::stable_token::stable_token::StableToken::{IC, LP};
use crate::stable_token::token::Token;
use crate::stable_token::token_map;
use crate::stable_user::user_map;

#[query(guard = "not_in_maintenance_mode")]
pub async fn user_balances(principal_id: String, symbol: Option<String>) -> Result<Vec<UserBalancesReply>, String> {
    let user_id = user_map::get_by_principal_id(&principal_id)
        .ok()
        .flatten()
        .ok_or("User not found")?
        .user_id;

    let mut user_balances = Vec::new();
    let ts = get_time();

    // if symbol is provided, get one token converting it to a vector,
    // otherwise get all tokens
    let tokens = match symbol {
        Some(symbol) => {
            vec![token_map::get_by_token(&symbol)?]
        }
        None => token_map::get(),
    };

    tokens.iter().for_each(|token| match token {
        LP(lp_token) => {
            if let Some(reply) = user_balance_lp_token_reply(lp_token, user_id, ts) {
                user_balances.push(reply);
            }
        }
        IC(_) => (),
    });

    Ok(user_balances)
}

fn user_balance_lp_token_reply(token: &LPToken, user_id: u32, ts: u64) -> Option<UserBalancesReply> {
    let lp_token_id = token.token_id;
    let lp_token = lp_token_map::get_by_token_id_by_user_id(lp_token_id, user_id)?;
    // user balance and total supply of the LP token
    let user_lp_token_balance = lp_token.amount;
    let lp_token_total_supply = lp_token_map::get_total_supply(lp_token_id);
    // pool of the LP token
    let pool = token.pool_of()?;

    // convert balance to real number
    let balance = nat_to_decimals_f64(token.decimals, &user_lp_token_balance)?;

    // user_amount_0 = reserve0 * user_lp_token_balance / lp_token_total_supply
    let token_0 = pool.token_0();
    let reserve0 = nat_add(&pool.balance_0, &pool.lp_fee_0);
    let numerator = nat_multiply(&reserve0, &user_lp_token_balance);
    let raw_amount_0 = nat_divide(&numerator, &lp_token_total_supply).unwrap_or(nat_zero());
    let amount_0 = nat_to_decimals_f64(token_0.decimals(), &raw_amount_0)?;
    let usd_amount_0 = ckusdt_amount(&token_0, &raw_amount_0)
        .and_then(|amount_0| to_ckusdt_decimals_f64(&amount_0).ok_or("Error converting amount 0 to ckUSDT".to_string()))
        .unwrap_or(0_f64);

    // user_amount_1 = reserve1 * user_lp_token_balance / lp_token_total_supply
    let token_1 = pool.token_1();
    let reserve1 = nat_add(&pool.balance_1, &pool.lp_fee_1);
    let numerator = nat_multiply(&reserve1, &user_lp_token_balance);
    let raw_amount_1 = nat_divide(&numerator, &lp_token_total_supply).unwrap_or(nat_zero());
    let amount_1 = nat_to_decimals_f64(token_1.decimals(), &raw_amount_1)?;
    let usd_amount_1 = ckusdt_amount(&token_1, &raw_amount_1)
        .and_then(|amount_1| to_ckusdt_decimals_f64(&amount_1).ok_or("Error converting amount 1 to ckUSDT".to_string()))
        .unwrap_or(0_f64);

    let usd_balance = usd_amount_0 + usd_amount_1;

    Some(UserBalancesReply::LP(LPReply {
        name: token.name(),
        symbol: token.symbol.clone(),
        balance,
        usd_balance,
        chain_0: token_0.chain(),
        symbol_0: token_0.symbol(),
        address_0: token_0.address(),
        amount_0,
        usd_amount_0,
        chain_1: token_1.chain(),
        symbol_1: token_1.symbol(),
        address_1: token_1.address(),
        amount_1,
        usd_amount_1,
        ts,
    }))
}
