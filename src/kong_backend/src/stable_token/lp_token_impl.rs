use super::lp_token::LPToken;
use super::token::Token;

use crate::chains::chains::LP_CHAIN;
use crate::stable_pool::pool_map;
use crate::stable_pool::stable_pool::StablePool;
use crate::stable_token::stable_token::StableToken;

impl LPToken {
    pub fn new(token_0: &StableToken, token_1: &StableToken, decimals: u8, on_kong: bool) -> Self {
        let symbol = symbol(token_0, token_1);
        // LP token's address is the combination of token_0's token_id and token_1's token_id
        // which is unique making it a unique identifier for the LP token
        let address = address(token_0, token_1);
        Self {
            token_id: 0,
            symbol,
            address,
            decimals,
            on_kong,
        }
    }

    pub fn name(&self) -> String {
        format!("{} LP Token", self.symbol)
    }

    pub fn chain(&self) -> String {
        LP_CHAIN.to_string()
    }

    /// Pool that the LP token belongs to
    pub fn pool_of(&self) -> Option<StablePool> {
        pool_map::get_by_lp_token_id(self.token_id)
    }
}

pub fn symbol(token_0: &StableToken, token_1: &StableToken) -> String {
    format!("{}_{}", token_0.symbol(), token_1.symbol())
}

pub fn address(token_0: &StableToken, token_1: &StableToken) -> String {
    format!("{}_{}", token_0.token_id(), token_1.token_id())
}
