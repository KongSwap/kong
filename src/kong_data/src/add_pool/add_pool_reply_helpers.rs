use crate::helpers::nat_helpers::nat_zero;
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
    let (symbol, chain_0, address_0, symbol_0, balance_0, chain_1, address_1, symbol_1, balance_1, lp_fee_bps, lp_token_symbol) =
        pool_map::get_by_pool_id(add_pool_tx.pool_id).map_or_else(
            || {
                (
                    "Pool symbol not found".to_string(),
                    "Pool chain_0 not found".to_string(),
                    "Pool address_0 not found".to_string(),
                    "Pool symbol_0 not found".to_string(),
                    nat_zero(),
                    "Pool chain_1 not found".to_string(),
                    "Pool address_1 not found".to_string(),
                    "Pool symbol_1 not found".to_string(),
                    nat_zero(),
                    0,
                    "LP token not found".to_string(),
                )
            },
            |pool| {
                let token_0 = pool.token_0();
                let chain_0 = token_0.chain();
                let address_0 = token_0.address();
                let symbol_0 = token_0.symbol();
                let balance_0 = pool.balance_0.clone();
                let token_1 = pool.token_1();
                let chain_1 = token_1.chain();
                let address_1 = token_1.address();
                let symbol_1 = token_1.symbol();
                let balance_1 = pool.balance_1.clone();
                (
                    pool.symbol(),
                    chain_0,
                    address_0,
                    symbol_0,
                    balance_0,
                    chain_1,
                    address_1,
                    symbol_1,
                    balance_1,
                    pool.lp_fee_bps,
                    pool.lp_token().symbol(),
                )
            },
        );
    AddPoolReply {
        tx_id,
        symbol,
        request_id: add_pool_tx.request_id,
        status: add_pool_tx.status.to_string(),
        chain_0,
        address_0,
        symbol_0,
        amount_0: add_pool_tx.amount_0.clone(),
        balance_0,
        chain_1,
        address_1,
        symbol_1,
        amount_1: add_pool_tx.amount_1.clone(),
        balance_1,
        lp_fee_bps,
        add_lp_token_amount: add_pool_tx.add_lp_token_amount.clone(),
        lp_token_symbol,
        transfer_ids: to_transfer_ids(&add_pool_tx.transfer_ids),
        claim_ids: add_pool_tx.claim_ids.clone(),
        on_kong: add_pool_tx.on_kong,
        ts: add_pool_tx.ts,
    }
}
