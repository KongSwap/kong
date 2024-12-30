use candid::Nat;

use super::pools_reply::{PoolReply, PoolsReply};

use crate::helpers::nat_helpers::{nat_add, nat_zero};
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
        is_removed: pool.is_removed,
        tvl: pool.tvl.clone(),
        rolling_24h_volume: pool.rolling_24h_volume.clone(),
        rolling_24h_lp_fee: pool.rolling_24h_lp_fee.clone(),
        rolling_24h_num_swaps: pool.rolling_24h_num_swaps.clone(),
        rolling_24h_apy: pool.rolling_24h_apy,
        lp_token_symbol,
    }
}

pub fn to_pools_reply(pools: Vec<PoolReply>) -> PoolsReply {
    let (total_tvl, total_24h_volume, total_24h_lp_fee, total_24h_num_swaps) = pools.iter().fold(
        (nat_zero(), nat_zero(), nat_zero(), nat_zero()),
        |acc, pool| -> (Nat, Nat, Nat, Nat) {
            (
                nat_add(&acc.0, &pool.tvl),
                nat_add(&acc.1, &pool.rolling_24h_volume),
                nat_add(&acc.2, &pool.rolling_24h_lp_fee),
                nat_add(&acc.3, &pool.rolling_24h_num_swaps),
            )
        },
    );
    PoolsReply {
        pools,
        total_tvl,
        total_24h_volume,
        total_24h_lp_fee,
        total_24h_num_swaps,
    }
}
