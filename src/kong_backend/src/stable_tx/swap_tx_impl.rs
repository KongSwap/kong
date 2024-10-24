use candid::Nat;

use super::status_tx::StatusTx;
use super::swap_tx::SwapTx;

use crate::swap::swap_calc::SwapCalc;

impl SwapTx {
    #[allow(clippy::too_many_arguments)]
    pub fn new_success(
        user_id: u32,
        request_id: u64,
        pay_token_id: u32,
        pay_amount: &Nat,
        receive_token_id: u32,
        receive_amount: &Nat,
        mid_price: f64,
        price: f64,
        slippage: f64,
        txs: &[SwapCalc],
        transfer_ids: &[u64],
        claim_ids: &[u64],
        ts: u64,
    ) -> Self {
        Self {
            tx_id: 0,
            user_id,
            request_id,
            status: StatusTx::Success,
            pay_token_id,
            pay_amount: pay_amount.clone(),
            receive_token_id,
            receive_amount: receive_amount.clone(),
            mid_price,
            price,
            slippage,
            txs: txs.to_vec(),
            transfer_ids: transfer_ids.to_vec(),
            claim_ids: claim_ids.to_vec(),
            ts,
        }
    }
}
