use candid::{CandidType, Principal};
use serde::{Deserialize, Serialize};

use crate::market::estimate_return_types::BetPayoutRecord;

use crate::types::{MarketId, TokenAmount};



/// Collection of payout records for a market
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MarketPayoutRecords {
    pub market_id: MarketId,
    pub payouts: Vec<BetPayoutRecord>,
    pub total_payout: TokenAmount,
    pub payout_count: usize,
    pub uses_time_weighting: bool,
}

impl MarketPayoutRecords {
    pub fn new(market_id: MarketId, uses_time_weighting: bool) -> Self {
        Self {
            market_id,
            payouts: Vec::new(),
            total_payout: TokenAmount::from(0u64),
            payout_count: 0,
            uses_time_weighting,
        }
    }

    pub fn add_payout(&mut self, payout: BetPayoutRecord) {
        self.total_payout = self.total_payout.clone() + payout.payout_amount.clone();
        self.payouts.push(payout);
        self.payout_count += 1;
    }
}

/// Summary of payouts for a user across all markets
#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct UserPayoutSummary {
    pub user: Principal,
    pub total_payouts: TokenAmount,
    pub payout_count: usize,
    pub markets_participated: Vec<MarketId>,
    pub time_weighted_payouts: TokenAmount,
    pub standard_payouts: TokenAmount,
}

impl UserPayoutSummary {
    pub fn new(user: Principal) -> Self {
        Self {
            user,
            total_payouts: TokenAmount::from(0u64),
            payout_count: 0,
            markets_participated: Vec::new(),
            time_weighted_payouts: TokenAmount::from(0u64),
            standard_payouts: TokenAmount::from(0u64),
        }
    }

    pub fn add_payout(&mut self, payout: &BetPayoutRecord) {
        self.total_payouts = self.total_payouts.clone() + payout.payout_amount.clone();
        self.payout_count += 1;
        
        if !self.markets_participated.contains(&payout.market_id) {
            self.markets_participated.push(payout.market_id.clone());
        }
        
        if payout.was_time_weighted {
            self.time_weighted_payouts = self.time_weighted_payouts.clone() + payout.payout_amount.clone();
        } else {
            self.standard_payouts = self.standard_payouts.clone() + payout.payout_amount.clone();
        }
    }
}
