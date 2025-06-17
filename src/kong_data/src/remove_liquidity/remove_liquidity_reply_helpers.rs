use super::remove_liquidity_reply::RemoveLiquidityReply;

use crate::stable_pool::pool_map;
use crate::stable_tx::remove_liquidity_tx::RemoveLiquidityTx;
use crate::transfers::transfer_reply_helpers::to_transfer_ids;

fn get_pool_info(pool_id: u32) -> (String, String, String, String, String, String, String) {
    pool_map::get_by_pool_id(pool_id).map_or_else(
        || {
            (
                "Pool symbol not found".to_string(),
                "Pool chain_0 not found".to_string(),
                "Pool address_0 not found".to_string(),
                "Pool symbol_0 not found".to_string(),
                "Pool chain_1 not found".to_string(),
                "Pool address_1 not found".to_string(),
                "Pool symbol_1 not found".to_string(),
            )
        },
        |pool| {
            (
                pool.symbol(),
                pool.chain_0(),
                pool.address_0(),
                pool.symbol_0(),
                pool.chain_1(),
                pool.address_1(),
                pool.symbol_1(),
            )
        },
    )
}

pub fn to_remove_liquidity_reply(remove_liquidity_tx: &RemoveLiquidityTx) -> RemoveLiquidityReply {
    let (symbol, chain_0, address_0, symbol_0, chain_1, address_1, symbol_1) = get_pool_info(remove_liquidity_tx.pool_id);
    RemoveLiquidityReply {
        tx_id: remove_liquidity_tx.tx_id,
        request_id: remove_liquidity_tx.request_id,
        status: remove_liquidity_tx.status.to_string(),
        symbol,
        chain_0,
        address_0,
        symbol_0,
        amount_0: remove_liquidity_tx.amount_0.clone(),
        lp_fee_0: remove_liquidity_tx.lp_fee_0.clone(),
        chain_1,
        address_1,
        symbol_1,
        amount_1: remove_liquidity_tx.amount_1.clone(),
        lp_fee_1: remove_liquidity_tx.lp_fee_1.clone(),
        remove_lp_token_amount: remove_liquidity_tx.remove_lp_token_amount.clone(),
        transfer_ids: to_transfer_ids(&remove_liquidity_tx.transfer_ids),
        claim_ids: remove_liquidity_tx.claim_ids.clone(),
        ts: remove_liquidity_tx.ts,
    }
}
