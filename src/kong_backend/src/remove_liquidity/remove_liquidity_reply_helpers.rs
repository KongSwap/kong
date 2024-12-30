use crate::helpers::nat_helpers::nat_zero;
use crate::stable_pool::pool_map;
use crate::stable_token::token::Token;
use crate::stable_tx::remove_liquidity_tx::RemoveLiquidityTx;
use crate::stable_tx::status_tx::StatusTx;
use crate::transfers::transfer_reply_helpers::to_transfer_ids;

use super::remove_liquidity_reply::RemoveLiquidityReply;

pub fn create_remove_liquidity_reply(remove_liquidity_tx: &RemoveLiquidityTx) -> RemoveLiquidityReply {
    create_remove_liquidity_reply_with_tx_id(remove_liquidity_tx.tx_id, remove_liquidity_tx)
}

pub fn create_remove_liquidity_reply_with_tx_id(tx_id: u64, remove_liquidity_tx: &RemoveLiquidityTx) -> RemoveLiquidityReply {
    let (symbol, chain_0, symbol_0, address_0, chain_1, address_1, symbol_1) = pool_map::get_by_pool_id(remove_liquidity_tx.pool_id)
        .map_or_else(
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
                let token_0 = pool.token_0();
                let chain_0 = token_0.chain();
                let address_0 = token_0.address();
                let symbol_0 = token_0.symbol();
                let token_1 = pool.token_1();
                let chain_1 = token_1.chain();
                let address_1 = token_1.address();
                let symbol_1 = token_1.symbol();
                (pool.symbol(), chain_0, symbol_0, address_0, chain_1, address_1, symbol_1)
            },
        );
    RemoveLiquidityReply {
        tx_id,
        symbol,
        request_id: remove_liquidity_tx.request_id,
        status: remove_liquidity_tx.status.to_string(),
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

pub fn create_remove_liquidity_reply_failed(pool_id: u32, request_id: u64, ts: u64) -> RemoveLiquidityReply {
    let (symbol, chain_0, symbol_0, address_0, chain_1, address_1, symbol_1) = pool_map::get_by_pool_id(pool_id).map_or_else(
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
            let token_0 = pool.token_0();
            let chain_0 = token_0.chain();
            let address_0 = token_0.address();
            let symbol_0 = token_0.symbol();
            let token_1 = pool.token_1();
            let chain_1 = token_1.chain();
            let address_1 = token_1.address();
            let symbol_1 = token_1.symbol();
            (pool.symbol(), chain_0, symbol_0, address_0, chain_1, address_1, symbol_1)
        },
    );
    RemoveLiquidityReply {
        tx_id: 0,
        request_id,
        status: StatusTx::Failed.to_string(),
        symbol,
        chain_0,
        address_0,
        symbol_0,
        amount_0: nat_zero(),
        lp_fee_0: nat_zero(),
        chain_1,
        address_1,
        symbol_1,
        amount_1: nat_zero(),
        lp_fee_1: nat_zero(),
        remove_lp_token_amount: nat_zero(),
        transfer_ids: Vec::new(), // if failed, transfer_ids is empty as no tokens are returned
        claim_ids: Vec::new(),    // if failed, claims_ids is empty as no LP tokens are returned
        ts,
    }
}
