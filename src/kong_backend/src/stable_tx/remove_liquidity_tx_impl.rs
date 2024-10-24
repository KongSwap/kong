use candid::Nat;

use super::remove_liquidity_tx::RemoveLiquidityTx;
use super::status_tx::StatusTx;

impl RemoveLiquidityTx {
    #[allow(clippy::too_many_arguments)]
    pub fn new_success(
        pool_id: u32,
        user_id: u32,
        request_id: u64,
        amount_0: &Nat,
        lp_fee_0: &Nat,
        amount_1: &Nat,
        lp_fee_1: &Nat,
        remove_lp_token_amount: &Nat,
        transfer_ids: &[u64],
        claim_ids: &[u64],
        ts: u64,
    ) -> Self {
        Self {
            tx_id: 0,
            pool_id,
            user_id,
            request_id,
            status: StatusTx::Success,
            amount_0: amount_0.clone(),
            lp_fee_0: lp_fee_0.clone(),
            amount_1: amount_1.clone(),
            lp_fee_1: lp_fee_1.clone(),
            remove_lp_token_amount: remove_lp_token_amount.clone(),
            transfer_ids: transfer_ids.to_vec(),
            claim_ids: claim_ids.to_vec(),
            ts,
        }
    }
}
