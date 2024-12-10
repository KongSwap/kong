use anyhow::Result;
use candid::{encode_args, Decode, Nat};

use super::add_liquidity_amounts_reply::AddLiquidityAmountsReply;

use crate::kong_backend::KongBackend;

impl KongBackend {
    pub async fn add_liquidity_amounts(
        &self,
        token_0: &str,
        amount: &Nat,
        token_1: &str,
    ) -> Result<AddLiquidityAmountsReply> {
        let results = self
            .agent
            .query(&self.principal_id, "add_liquidity_amounts")
            .with_arg(encode_args((token_0, amount, token_1))?)
            .await?;
        Decode!(results.as_slice(), Result<AddLiquidityAmountsReply, String>)?.map_err(|e| anyhow::anyhow!(e))
    }
}
