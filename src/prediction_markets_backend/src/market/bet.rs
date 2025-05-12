use candid::{CandidType, Deserialize, Principal};
use crate::nat::StorableNat;
use crate::types::{MarketId, Timestamp, OutcomeIndex};

/// Represents a bet placed on a market outcome
#[derive(CandidType, Clone, Debug, Deserialize)]
pub struct Bet {
    pub user: Principal,
    pub market_id: MarketId,
    pub amount: StorableNat,
    pub outcome_index: OutcomeIndex,
    pub timestamp: Timestamp,
}

/// A collection of bets for a market
#[derive(CandidType, Clone, Debug, Deserialize, Default)]
pub struct BetStore(pub Vec<Bet>);

impl BetStore {
    pub fn new() -> Self {
        BetStore(Vec::new())
    }

    pub fn add_bet(&mut self, bet: Bet) {
        self.0.push(bet);
    }

    pub fn get_bets_for_user(&self, user: &Principal) -> Vec<Bet> {
        self.0
            .iter()
            .filter(|bet| bet.user == *user)
            .cloned()
            .collect()
    }

    pub fn get_bets_for_outcome(&self, outcome_index: &OutcomeIndex) -> Vec<Bet> {
        self.0
            .iter()
            .filter(|bet| bet.outcome_index == *outcome_index)
            .cloned()
            .collect()
    }
}
