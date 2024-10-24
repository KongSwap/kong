use crate::helpers::nat_helpers::nat_zero;
use crate::stable_pool::pool_map;
use crate::stable_tx::remove_liquidity_tx::RemoveLiquidityTx;
use crate::stable_tx::status_tx::StatusTx;
use crate::transfers::transfer_reply_impl::to_transfer_ids;

use super::remove_liquidity_reply::RemoveLiquidityReply;

impl RemoveLiquidityReply {
    pub fn new(remove_liquidity_tx: &RemoveLiquidityTx) -> Self {
        Self::new_with_tx_id(remove_liquidity_tx.tx_id, remove_liquidity_tx)
    }

    pub fn new_with_tx_id(tx_id: u64, remove_liquidity_tx: &RemoveLiquidityTx) -> Self {
        let (symbol, chain_0, symbol_0, chain_1, symbol_1) = pool_map::get_by_pool_id(remove_liquidity_tx.pool_id)
            .map(|pool| (pool.symbol(), pool.chain_0(), pool.symbol_0(), pool.chain_1(), pool.symbol_1()))
            .unwrap_or((
                "Pool symbol not found".to_string(),
                "Pool chain_0 not found".to_string(),
                "Pool symbol_0 not found".to_string(),
                "Pool chain_1 not found".to_string(),
                "Pool symbol_1 not found".to_string(),
            ));
        Self {
            tx_id,
            symbol,
            request_id: remove_liquidity_tx.request_id,
            status: remove_liquidity_tx.status.to_string(),
            chain_0,
            symbol_0,
            amount_0: remove_liquidity_tx.amount_0.clone(),
            lp_fee_0: remove_liquidity_tx.lp_fee_0.clone(),
            chain_1,
            symbol_1,
            amount_1: remove_liquidity_tx.amount_1.clone(),
            lp_fee_1: remove_liquidity_tx.lp_fee_1.clone(),
            remove_lp_token_amount: remove_liquidity_tx.remove_lp_token_amount.clone(),
            transfer_ids: to_transfer_ids(&remove_liquidity_tx.transfer_ids),
            claim_ids: remove_liquidity_tx.claim_ids.clone(),
            ts: remove_liquidity_tx.ts,
        }
    }

    pub fn new_failed(pool_id: u32, request_id: u64, transfer_ids: &[u64], ts: u64) -> Self {
        let (symbol, chain_0, symbol_0, chain_1, symbol_1) = pool_map::get_by_pool_id(pool_id)
            .map(|pool| (pool.symbol(), pool.chain_0(), pool.symbol_0(), pool.chain_1(), pool.symbol_1()))
            .unwrap_or((
                "Pool symbol not found".to_string(),
                "Pool chain_0 not found".to_string(),
                "Pool symbol_0 not found".to_string(),
                "Pool chain_1 not found".to_string(),
                "Pool symbol_1 not found".to_string(),
            ));
        Self {
            tx_id: 0,
            symbol,
            request_id,
            status: StatusTx::Failed.to_string(),
            chain_0,
            symbol_0,
            amount_0: nat_zero(),
            lp_fee_0: nat_zero(),
            chain_1,
            symbol_1,
            amount_1: nat_zero(),
            lp_fee_1: nat_zero(),
            remove_lp_token_amount: nat_zero(),
            transfer_ids: to_transfer_ids(transfer_ids),
            claim_ids: Vec::new(), // if failed, claims_ids is empty as no LP tokens are returned
            ts,
        }
    }
}
