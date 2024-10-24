use crate::helpers::nat_helpers::nat_zero;
use crate::stable_pool::pool_map;
use crate::stable_tx::add_liquidity_tx::AddLiquidityTx;
use crate::stable_tx::status_tx::StatusTx;
use crate::transfers::transfer_reply_impl::to_transfer_ids;

use super::add_liquidity_reply::AddLiquidityReply;

impl AddLiquidityReply {
    pub fn new(add_liquidity_tx: &AddLiquidityTx) -> Self {
        Self::new_with_tx_id(add_liquidity_tx.tx_id, add_liquidity_tx)
    }

    pub fn new_with_tx_id(tx_id: u64, add_liquidity_tx: &AddLiquidityTx) -> Self {
        let (symbol, chain_0, symbol_0, chain_1, symbol_1) = pool_map::get_by_pool_id(add_liquidity_tx.pool_id).map_or_else(
            || {
                (
                    "Pool symbol not found".to_string(),
                    "Pool chain_0 not found".to_string(),
                    "Pool symbol_0 not found".to_string(),
                    "Pool chain_1 not found".to_string(),
                    "Pool symbol_1 not found".to_string(),
                )
            },
            |pool| (pool.symbol(), pool.chain_0(), pool.symbol_0(), pool.chain_1(), pool.symbol_1()),
        );
        Self {
            tx_id,
            symbol,
            request_id: add_liquidity_tx.request_id,
            status: add_liquidity_tx.status.to_string(),
            chain_0,
            symbol_0,
            amount_0: add_liquidity_tx.amount_0.clone(),
            chain_1,
            symbol_1,
            amount_1: add_liquidity_tx.amount_1.clone(),
            add_lp_token_amount: add_liquidity_tx.add_lp_token_amount.clone(),
            transfer_ids: to_transfer_ids(&add_liquidity_tx.transfer_ids),
            claim_ids: add_liquidity_tx.claim_ids.clone(),
            ts: add_liquidity_tx.ts,
        }
    }

    pub fn new_failed(pool_id: u32, request_id: u64, transfer_ids: &[u64], claim_ids: &[u64], ts: u64) -> Self {
        let (symbol, chain_0, symbol_0, chain_1, symbol_1) = pool_map::get_by_pool_id(pool_id).map_or_else(
            || {
                (
                    "Pool not found".to_string(),
                    "Pool chain_0 not found".to_string(),
                    "Pool symbol_0 not found".to_string(),
                    "Pool chain_1 not found".to_string(),
                    "Pool symbol_1 not found".to_string(),
                )
            },
            |pool| (pool.symbol(), pool.chain_0(), pool.symbol_0(), pool.chain_1(), pool.symbol_1()),
        );
        Self {
            tx_id: 0,
            symbol,
            request_id,
            status: StatusTx::Failed.to_string(),
            chain_0,
            symbol_0,
            amount_0: nat_zero(),
            chain_1,
            symbol_1,
            amount_1: nat_zero(),
            add_lp_token_amount: nat_zero(),
            transfer_ids: to_transfer_ids(transfer_ids),
            claim_ids: claim_ids.to_vec(),
            ts,
        }
    }
}
