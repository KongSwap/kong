use super::pools_reply::PoolReply;

use crate::stable_pool::stable_pool::StablePool;
use crate::stable_token::token::Token;
use crate::stable_token::token_map;

pub fn to_pool_reply(pool: &StablePool) -> PoolReply {
    let token_0 = token_map::get_by_token_id(pool.token_id_0);
    let token_1 = token_map::get_by_token_id(pool.token_id_1);
    let lp_token = pool.lp_token();
    let lp_token_symbol = lp_token.symbol().to_string();

    PoolReply {
        pool_id: pool.pool_id,
        name: pool.name(),
        symbol: pool.symbol(),
        chain_0: match &token_0 {
            Some(token) => token.chain().to_string(),
            None => "Chain_0 not found".to_string(),
        },
        symbol_0: match &token_0 {
            Some(token) => token.symbol().to_string(),
            None => "Symbol_0 not found".to_string(),
        },
        address_0: match &token_0 {
            Some(token) => token.address().to_string(),
            None => "Address_0 not found".to_string(),
        },
        balance_0: pool.balance_0.clone(),
        lp_fee_0: pool.lp_fee_0.clone(),
        chain_1: match &token_1 {
            Some(token) => token.chain().to_string(),
            None => "Chain_1 not found".to_string(),
        },
        symbol_1: match &token_1 {
            Some(token) => token.symbol().to_string(),
            None => "Symbol_1 not found".to_string(),
        },
        address_1: match &token_1 {
            Some(token) => token.address().to_string(),
            None => "Address_1 not found".to_string(),
        },
        balance_1: pool.balance_1.clone(),
        lp_fee_1: pool.lp_fee_1.clone(),
        price: pool.get_price_as_f64().unwrap_or(0_f64),
        lp_fee_bps: pool.lp_fee_bps,
        lp_token_symbol,
        is_removed: pool.is_removed,
    }
}
