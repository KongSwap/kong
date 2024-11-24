use crate::helpers::nat_helpers::nat_zero;
use crate::stable_lp_token_ledger::lp_token_ledger;
use crate::stable_pool::pool_map;
use crate::stable_token::token::Token;
use crate::stable_tx::add_pool_tx::AddPoolTx;
use crate::transfers::transfer_reply_helpers::to_transfer_ids;

use super::add_pool_reply::AddPoolReply;

// helpers for add_pool_reply
// should be part of AddPoolReply but these are in kong_lib so could not extend

pub fn create_add_pool_reply(add_pool_tx: &AddPoolTx) -> AddPoolReply {
    create_add_pool_reply_with_tx_id(add_pool_tx.tx_id, add_pool_tx)
}

pub fn create_add_pool_reply_with_tx_id(tx_id: u64, add_pool_tx: &AddPoolTx) -> AddPoolReply {
    let (symbol, chain_0, symbol_0, balance_0, chain_1, symbol_1, balance_1, lp_fee_bps, lp_token_symbol, lp_token_supply) =
        pool_map::get_by_pool_id(add_pool_tx.pool_id).map_or_else(
            || {
                (
                    "Pool symbol not found".to_string(),
                    "Pool chain_0 not found".to_string(),
                    "Pool symbol_0 not found".to_string(),
                    nat_zero(),
                    "Pool chain_1 not found".to_string(),
                    "Pool symbol_1 not found".to_string(),
                    nat_zero(),
                    0,
                    "LP token not found".to_string(),
                    nat_zero(),
                )
            },
            |pool| {
                (
                    pool.symbol(),
                    pool.chain_0(),
                    pool.symbol_0(),
                    pool.balance_0.clone(),
                    pool.chain_1(),
                    pool.symbol_1(),
                    pool.balance_1.clone(),
                    pool.lp_fee_bps,
                    pool.lp_token().symbol().to_string(),
                    lp_token_ledger::get_total_supply(pool.lp_token_id),
                )
            },
        );
    AddPoolReply {
        tx_id,
        symbol,
        request_id: add_pool_tx.request_id,
        status: add_pool_tx.status.to_string(),
        chain_0,
        symbol_0,
        amount_0: add_pool_tx.amount_0.clone(),
        balance_0,
        chain_1,
        symbol_1,
        amount_1: add_pool_tx.amount_1.clone(),
        balance_1,
        lp_fee_bps,
        add_lp_token_amount: add_pool_tx.add_lp_token_amount.clone(),
        lp_token_symbol,
        lp_token_supply,
        transfer_ids: to_transfer_ids(&add_pool_tx.transfer_ids),
        claim_ids: add_pool_tx.claim_ids.clone(),
        on_kong: add_pool_tx.on_kong,
        ts: add_pool_tx.ts,
    }
}
