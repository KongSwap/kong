use crate::add_liquidity::add_liquidity_reply_helpers::create_add_liquidity_reply;
use crate::add_pool::add_pool_reply_helpers::create_add_pool_reply;
use crate::remove_liquidity::remove_liquidity_reply_helpers::create_remove_liquidity_reply;
use crate::send::send_reply_helpers::create_send_reply;
use crate::stable_tx::stable_tx::StableTx::{self, AddLiquidity, AddPool, RemoveLiquidity, Send, Swap};
use crate::swap::swap_reply_helpers::create_swap_reply;

use super::txs_reply::TxsReply;

pub fn to_txs_reply(tx: &StableTx) -> TxsReply {
    match tx {
        AddPool(tx) => TxsReply::AddPool(create_add_pool_reply(tx)),
        AddLiquidity(tx) => TxsReply::AddLiquidity(create_add_liquidity_reply(tx)),
        RemoveLiquidity(tx) => TxsReply::RemoveLiquidity(create_remove_liquidity_reply(tx)),
        Swap(tx) => TxsReply::Swap(create_swap_reply(tx)),
        Send(tx) => TxsReply::Send(create_send_reply(tx)),
    }
}
