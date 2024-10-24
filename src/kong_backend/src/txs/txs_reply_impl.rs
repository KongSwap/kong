use crate::add_liquidity::add_liquidity_reply::AddLiquidityReply;
use crate::add_pool::add_pool_reply::AddPoolReply;
use crate::remove_liquidity::remove_liquidity_reply::RemoveLiquidityReply;
use crate::send::send_reply::SendReply;
use crate::stable_tx::stable_tx::StableTx::{self, AddLiquidity, AddPool, RemoveLiquidity, Send, Swap};
use crate::swap::swap_reply::SwapReply;

use super::txs_reply::TxsReply;

pub fn to_txs_reply(tx: &StableTx) -> TxsReply {
    match tx {
        AddPool(tx) => TxsReply::AddPool(AddPoolReply::new(tx)),
        AddLiquidity(tx) => TxsReply::AddLiquidity(AddLiquidityReply::new(tx)),
        RemoveLiquidity(tx) => TxsReply::RemoveLiquidity(RemoveLiquidityReply::new(tx)),
        Swap(tx) => TxsReply::Swap(SwapReply::new(tx)),
        Send(tx) => TxsReply::Send(SendReply::new(tx)),
    }
}
