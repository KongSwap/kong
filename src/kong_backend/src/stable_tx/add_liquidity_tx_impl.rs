use candid::Nat;

use super::add_liquidity_tx::AddLiquidityTx;
use super::status_tx::StatusTx;

impl AddLiquidityTx {
    #[allow(clippy::too_many_arguments)]
    pub fn new_success(
        pool_id: u32,
        user_id: u32,
        request_id: u64,
        amount_0: &Nat,
        amount_1: &Nat,
        add_lp_token_amount: &Nat,
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
            amount_1: amount_1.clone(),
            add_lp_token_amount: add_lp_token_amount.clone(),
            transfer_ids: transfer_ids.to_vec(),
            claim_ids: claim_ids.to_vec(),
            ts,
        }
    }
}
