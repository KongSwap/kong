use super::add_pool_reply::AddPoolReply;

use crate::helpers::nat_helpers::nat_zero;
use crate::stable_pool::pool_map;
use crate::stable_token::token::Token;
use crate::stable_tx::add_pool_tx::AddPoolTx;
use crate::stable_tx::status_tx::StatusTx;
use crate::transfers::transfer_reply_helpers::to_transfer_ids;

fn get_pool_info(
    pool_id: u32,
) -> (
    String,
    String,
    String,
    String,
    String,
    candid::Nat,
    String,
    String,
    String,
    candid::Nat,
    u8,
    String,
) {
    pool_map::get_by_pool_id(pool_id).map_or_else(
        || {
            (
                "Pool name not added".to_string(),
                "Pool symbol not added".to_string(),
                "Pool chain_0 not added".to_string(),
                "Pool address_0 not added".to_string(),
                "Pool symbol_0 not added".to_string(),
                nat_zero(),
                "Pool chain_1 not added".to_string(),
                "Pool address_1 not added".to_string(),
                "Pool symbol_1 not added".to_string(),
                nat_zero(),
                0,
                "LP token not added".to_string(),
            )
        },
        |pool| {
            (
                pool.name(),
                pool.symbol(),
                pool.chain_0(),
                pool.address_0(),
                pool.symbol_0(),
                pool.balance_0.clone(),
                pool.chain_1(),
                pool.address_1(),
                pool.symbol_1(),
                pool.balance_1.clone(),
                pool.lp_fee_bps,
                pool.lp_token().symbol().to_string(),
            )
        },
    )
}

pub fn to_add_pool_reply(add_pool_tx: &AddPoolTx) -> AddPoolReply {
    let (name, symbol, chain_0, address_0, symbol_0, balance_0, chain_1, address_1, symbol_1, balance_1, lp_fee_bps, lp_token_symbol) =
        get_pool_info(add_pool_tx.pool_id);
    AddPoolReply {
        tx_id: add_pool_tx.tx_id,
        pool_id: add_pool_tx.pool_id,
        request_id: add_pool_tx.request_id,
        status: add_pool_tx.status.to_string(),
        name,
        symbol,
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
        is_removed: add_pool_tx.is_removed,
        ts: add_pool_tx.ts,
    }
}

#[allow(clippy::too_many_arguments)]
pub fn to_add_pool_reply_failed(
    request_id: u64,
    chain_0: &str,
    address_0: &str,
    symbol_0: &str,
    chain_1: &str,
    address_1: &str,
    symbol_1: &str,
    transfer_ids: &[u64],
    claim_ids: &[u64],
    ts: u64,
) -> AddPoolReply {
    AddPoolReply {
        tx_id: 0,
        pool_id: 0,
        request_id,
        status: StatusTx::Failed.to_string(),
        name: "Pool not added".to_string(),
        symbol: "Pool not added".to_string(),
        chain_0: chain_0.to_string(),
        address_0: address_0.to_string(),
        symbol_0: symbol_0.to_string(),
        amount_0: nat_zero(),
        balance_0: nat_zero(),
        chain_1: chain_1.to_string(),
        address_1: address_1.to_string(),
        symbol_1: symbol_1.to_string(),
        amount_1: nat_zero(),
        balance_1: nat_zero(),
        add_lp_token_amount: nat_zero(),
        lp_fee_bps: 0,
        lp_token_symbol: "LP token not added".to_string(),
        transfer_ids: to_transfer_ids(transfer_ids),
        claim_ids: claim_ids.to_vec(),
        is_removed: false,
        ts,
    }
}
