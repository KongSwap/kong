use std::{
    cell::RefCell,
    collections::{BTreeMap, HashMap},
};

use candid::Principal;
use ic_cdk::{query, update};

use crate::{
    canister::MARKET_PAYOUTS, controllers::admin::is_admin, market::market::MarketStatus, storage::MARKETS,
    token::registry::TokenIdentifier, TokenAmount,
};

use super::user::*;

thread_local! {
    pub static USER_BETTING_SUMMARY_CACHE: RefCell<BTreeMap<Principal, UserBettingSummary>> =
        RefCell::new(BTreeMap::new());
}

fn reduce_and_erase_if_zero(bets: &mut HashMap<TokenIdentifier, TokenAmount>, token_id: &TokenIdentifier, amount: &TokenAmount) {
    if let std::collections::hash_map::Entry::Occupied(mut entry) = bets.entry(token_id.clone()) {
        *entry.get_mut() -= amount.clone();
        if entry.get().is_zero() {
            entry.remove();
        }
    } else {
        ic_cdk::eprintln!("Missing entry on reducing amount from stats, token={}, amount={}", token_id, amount);
    }
}

pub fn on_new_bet(bet: &crate::bet::bet::Bet) {
    USER_BETTING_SUMMARY_CACHE.with(|m| {
        let mut m = m.borrow_mut();
        let user_betting_summary = m.entry(bet.user).or_default();
        *user_betting_summary.active_bets.entry(bet.token_id.clone()).or_default() += bet.amount.clone();
        *user_betting_summary.total_wagered.entry(bet.token_id.clone()).or_default() += bet.amount.clone();
    })
}

pub fn on_refunded_bet(bet: &crate::bet::bet::Bet) {
    USER_BETTING_SUMMARY_CACHE.with(|m| {
        let mut m = m.borrow_mut();
        let user_betting_summary = m.entry(bet.user).or_default();
        reduce_and_erase_if_zero(&mut user_betting_summary.active_bets, &bet.token_id, &bet.amount);
        reduce_and_erase_if_zero(&mut user_betting_summary.total_wagered, &bet.token_id, &bet.amount);
    })
}

pub fn on_finished_market_bet(bet: &crate::bet::bet::Bet, payout: Option<TokenAmount>) {
    USER_BETTING_SUMMARY_CACHE.with(|m| {
        let mut m = m.borrow_mut();
        let user_betting_summary = m.entry(bet.user).or_default();
        reduce_and_erase_if_zero(&mut user_betting_summary.active_bets, &bet.token_id, &bet.amount);
        if let Some(payout) = payout {
            *user_betting_summary.total_won.entry(bet.token_id.clone()).or_default() += payout;
        }
    })
}

pub fn on_manual_reduce_active_bets(user: Principal, token_id: TokenIdentifier, amount: &TokenAmount) {
    USER_BETTING_SUMMARY_CACHE.with(|m| {
        let mut m = m.borrow_mut();
        let user_betting_summary = m.entry(user).or_default();

        reduce_and_erase_if_zero(&mut user_betting_summary.active_bets, &token_id, amount);
    })
}

fn on_manual_increase_total_won(user: Principal, token_id: TokenIdentifier, amount: TokenAmount) {
    USER_BETTING_SUMMARY_CACHE.with(|m| {
        let mut m = m.borrow_mut();
        let user_betting_summary = m.entry(user).or_default();
        *user_betting_summary.total_won.entry(token_id.clone()).or_default() += amount;
    })
}

#[query]
pub fn get_user_betting_summary(user: Principal) -> UserBettingSummary {
    USER_BETTING_SUMMARY_CACHE.with(|m| m.borrow().get(&user).cloned().unwrap_or_default())
}

/// Update betting summary for all users
#[update]
pub fn recalculate_betting_summary() -> String {
    // Verify caller is an admin
    if !is_admin(ic_cdk::caller()) {
        return "Unauthorized".to_string();
    }

    recalculate_betting_summary_impl()
}

pub fn recalculate_betting_summary_impl() -> String {
    USER_BETTING_SUMMARY_CACHE.with_borrow_mut(|m| m.clear());

    MARKETS.with_borrow(|markets| {
        for (market_id, market) in markets.iter() {
            fn dummy(_: &crate::bet::bet::Bet) {}
            fn finished_market(b: &crate::bet::bet::Bet) {
                on_finished_market_bet(b, None);
            } // will increase total won after
            let apply_fn = match market.status {
                MarketStatus::PendingActivation | MarketStatus::Active | MarketStatus::ExpiredUnresolved => dummy,
                MarketStatus::Closed(_) => finished_market,
                MarketStatus::Disputed => on_refunded_bet,
                MarketStatus::Voided => on_refunded_bet,
            };

            let bets = crate::storage::get_bets_for_market(&market_id);
            for bet in bets {
                on_new_bet(&bet);
                apply_fn(&bet);
            }

            if let MarketStatus::Closed(_) = market.status {
                MARKET_PAYOUTS.with_borrow(|p| {
                    if let Some(payouts) = p.get(&market_id) {
                        for payout in payouts {
                            on_manual_increase_total_won(payout.user, payout.token_id.clone(), payout.payout_amount.clone());
                        }
                    }
                })
            }
        }
    });
    String::new()
}
