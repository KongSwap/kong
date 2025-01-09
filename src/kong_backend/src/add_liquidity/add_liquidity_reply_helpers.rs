use super::add_liquidity_reply::AddLiquidityReply;

use crate::helpers::nat_helpers::nat_zero;
use crate::stable_pool::pool_map;
use crate::stable_tx::add_liquidity_tx::AddLiquidityTx;
use crate::stable_tx::status_tx::StatusTx;
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

pub fn to_add_liquidity_reply(add_liquidity_tx: &AddLiquidityTx) -> AddLiquidityReply {
    let (symbol, chain_0, address_0, symbol_0, chain_1, address_1, symbol_1) = get_pool_info(add_liquidity_tx.pool_id);
    AddLiquidityReply {
        tx_id: add_liquidity_tx.tx_id,
        request_id: add_liquidity_tx.request_id,
        status: add_liquidity_tx.status.to_string(),
        symbol,
        chain_0,
        address_0,
        symbol_0,
        amount_0: add_liquidity_tx.amount_0.clone(),
        chain_1,
        address_1,
        symbol_1,
        amount_1: add_liquidity_tx.amount_1.clone(),
        add_lp_token_amount: add_liquidity_tx.add_lp_token_amount.clone(),
        transfer_ids: to_transfer_ids(&add_liquidity_tx.transfer_ids),
        claim_ids: add_liquidity_tx.claim_ids.clone(),
        ts: add_liquidity_tx.ts,
    }
}

pub fn to_add_liquidity_reply_failed(pool_id: u32, request_id: u64, transfer_ids: &[u64], claim_ids: &[u64], ts: u64) -> AddLiquidityReply {
    let (symbol, chain_0, address_0, symbol_0, chain_1, address_1, symbol_1) = get_pool_info(pool_id);
    AddLiquidityReply {
        tx_id: 0,
        request_id,
        status: StatusTx::Failed.to_string(),
        symbol,
        chain_0,
        address_0,
        symbol_0,
        amount_0: nat_zero(),
        chain_1,
        address_1,
        symbol_1,
        amount_1: nat_zero(),
        add_lp_token_amount: nat_zero(),
        transfer_ids: to_transfer_ids(transfer_ids),
        claim_ids: claim_ids.to_vec(),
        ts,
    }
}
