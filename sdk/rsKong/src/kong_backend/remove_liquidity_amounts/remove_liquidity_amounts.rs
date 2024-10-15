use anyhow::Result;
use candid::{encode_args, Decode, Nat};

use super::remove_liquidity_amounts_reply::RemoveLiquidityAmountsReply;

use crate::kong_backend::KongBackend;

impl KongBackend {
    #[allow(dead_code)]
    pub async fn remove_liquidity_amounts(
        &self,
        token_0: &str,
        token_1: &str,
        remove_lp_token_amount: &Nat,
    ) -> Result<RemoveLiquidityAmountsReply> {
        let results = self
            .agent
            .query(&self.principal_id, "remove_liquidity_amounts")
            .with_arg(encode_args((token_0, token_1, remove_lp_token_amount))?)
            .await?;
        Decode!(results.as_slice(), Result<RemoveLiquidityAmountsReply, String>)?.map_err(|e| anyhow::anyhow!(e))
    }
}
