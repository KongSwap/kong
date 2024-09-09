use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Debug, Deserialize, Serialize)]
pub struct SwapAmountsTxReply {
    pub pool_symbol: String,
    pub pay_chain: String,
    pub pay_symbol: String,
    pub pay_amount: Nat,
    pub receive_chain: String,
    pub receive_symbol: String,
    pub receive_amount: Nat,
    pub price: f64,
    pub lp_fee: Nat,
    pub gas_fee: Nat,
}

#[derive(CandidType, Debug, Deserialize, Serialize)]
pub struct SwapAmountsReply {
    pub pay_chain: String,
    pub pay_symbol: String,
    pub pay_amount: Nat,
    pub receive_chain: String,
    pub receive_symbol: String,
    pub receive_amount: Nat,
    pub mid_price: f64,
    pub price: f64,
    pub slippage: f64,
    pub txs: Vec<SwapAmountsTxReply>,
}
