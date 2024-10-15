use candid::{CandidType, Nat};
use num::{BigRational, Zero};
use serde::{Deserialize, Serialize};

use super::swap_calc::SwapCalc;

use crate::helpers::math_helpers::price_rounded;
use crate::helpers::nat_helpers::nat_zero;
use crate::stable_pool::pool_map;
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::token::Token;
use crate::stable_token::token_map;
use crate::stable_tx::status_tx::StatusTx;
use crate::stable_tx::swap_tx::SwapTx;
use crate::transfers::transfer_reply::{to_transfer_ids, TransferIdReply};

/// Data structure for the reply of the `swap` function.
/// Used in StableRequest
#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct SwapTxReply {
    pub pool_symbol: String,
    pub pay_chain: String,
    pub pay_symbol: String,
    pub pay_amount: Nat,
    pub receive_chain: String,
    pub receive_symbol: String,
    pub receive_amount: Nat, // including fees
    pub price: f64,
    pub lp_fee: Nat,  // will be in receive_symbol
    pub gas_fee: Nat, // will be in receive_symbol
    pub ts: u64,
}

pub fn to_txs(txs: &[SwapCalc], ts: u64) -> Vec<SwapTxReply> {
    txs.iter().filter_map(|tx| to_swap_tx_reply(tx, ts)).collect()
}

fn to_swap_tx_reply(swap: &SwapCalc, ts: u64) -> Option<SwapTxReply> {
    let pool = pool_map::get_by_pool_id(swap.pool_id)?;
    let pay_token = token_map::get_by_token_id(swap.pay_token_id)?;
    let pay_chain = pay_token.chain().to_string();
    let pay_symbol = pay_token.symbol().to_string();
    let receive_token = token_map::get_by_token_id(swap.receive_token_id)?;
    let receive_chain = receive_token.chain().to_string();
    let receive_symbol = receive_token.symbol().to_string();
    let price = swap.get_price().unwrap_or(BigRational::zero());
    let price_f64 = price_rounded(&price).unwrap_or(0_f64);
    Some(SwapTxReply {
        pool_symbol: pool.symbol(),
        pay_chain,
        pay_symbol,
        pay_amount: swap.pay_amount.clone(),
        receive_chain,
        receive_symbol,
        receive_amount: swap.receive_amount.clone(),
        price: price_f64,
        lp_fee: swap.lp_fee.clone(),
        gas_fee: swap.gas_fee.clone(),
        ts,
    })
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct SwapReply {
    pub tx_id: u64,
    pub request_id: u64,
    pub status: String,
    pub pay_chain: String,
    pub pay_symbol: String,
    pub pay_amount: Nat,
    pub receive_chain: String,
    pub receive_symbol: String,
    pub receive_amount: Nat,
    pub mid_price: f64,
    pub price: f64,
    pub slippage: f64,
    pub txs: Vec<SwapTxReply>,
    pub transfer_ids: Vec<TransferIdReply>,
    pub claim_ids: Vec<u64>,
    pub ts: u64,
}

#[allow(clippy::too_many_arguments)]
impl SwapReply {
    pub fn new(swap_tx: &SwapTx) -> Self {
        Self::new_with_tx_id(swap_tx.tx_id, swap_tx)
    }

    pub fn new_with_tx_id(tx_id: u64, swap_tx: &SwapTx) -> Self {
        let pay_token = token_map::get_by_token_id(swap_tx.pay_token_id);
        let (pay_chain, pay_symbol) = pay_token.map_or_else(
            || ("Pay chain not found".to_string(), "Pay symbol not found".to_string()),
            |token| (token.chain().to_string(), token.symbol().to_string()),
        );
        let receive_token = token_map::get_by_token_id(swap_tx.receive_token_id);
        let (receive_chain, receive_symbol) = receive_token.map_or_else(
            || ("Receive chain not found".to_string(), "Receive symbol not found".to_string()),
            |token| (token.chain().to_string(), token.symbol().to_string()),
        );
        Self {
            tx_id,
            request_id: swap_tx.request_id,
            status: swap_tx.status.to_string(),
            pay_chain,
            pay_symbol,
            pay_amount: swap_tx.pay_amount.clone(),
            receive_chain,
            receive_symbol,
            receive_amount: swap_tx.receive_amount.clone(),
            mid_price: swap_tx.mid_price,
            price: swap_tx.price,
            slippage: swap_tx.slippage,
            txs: to_txs(&swap_tx.txs, swap_tx.ts),
            transfer_ids: to_transfer_ids(&swap_tx.transfer_ids),
            claim_ids: swap_tx.claim_ids.clone(),
            ts: swap_tx.ts,
        }
    }

    pub fn new_failed(
        request_id: u64,
        pay_token: &StableToken,
        pay_amount: &Nat,
        receive_token: Option<&StableToken>,
        transfer_ids: &[u64],
        claim_ids: &[u64],
        ts: u64,
    ) -> Self {
        // Pay token
        let pay_chain = pay_token.chain().to_string();
        let pay_symbol = pay_token.symbol().to_string();
        // Receive token
        let receive_chain = receive_token.map_or_else(|| "Receive chain not found".to_string(), |token| token.chain().to_string());
        let receive_symbol = receive_token.map_or_else(|| "Receive symbol not found".to_string(), |token| token.symbol().to_string());
        Self {
            tx_id: 0,
            request_id,
            status: StatusTx::Failed.to_string(),
            pay_chain,
            pay_symbol,
            pay_amount: pay_amount.clone(),
            receive_chain,
            receive_symbol,
            receive_amount: nat_zero(),
            mid_price: 0_f64,
            price: 0_f64,
            slippage: 0_f64,
            txs: Vec::new(),
            transfer_ids: to_transfer_ids(transfer_ids),
            claim_ids: claim_ids.to_vec(),
            ts,
        }
    }
}
