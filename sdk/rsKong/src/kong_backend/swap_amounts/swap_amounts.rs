use anyhow::Result;
use candid::{encode_args, Decode, Nat};

use super::swap_amounts_reply::SwapAmountsReply;

use crate::kong_backend::KongBackend;

impl KongBackend {
    pub async fn swap_amounts(
        &self,
        pay_symbol: &str,
        pay_amount: &Nat,
        receive_symbol: &str,
    ) -> Result<SwapAmountsReply> {
        let results = self
            .agent
            .query(&self.principal_id, "swap_amounts")
            .with_arg(encode_args((pay_symbol, pay_amount, receive_symbol))?)
            .await?;
        Decode!(results.as_slice(), Result<SwapAmountsReply, String>)?.map_err(|e| anyhow::anyhow!(e))
    }
}
