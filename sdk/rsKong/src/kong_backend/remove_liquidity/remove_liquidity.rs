use anyhow::Result;
use candid::{Decode, Encode};

use super::remove_liquidity_args::RemoveLiquidityArgs;
use super::remove_liquidity_reply::RemoveLiquidityReply;

use crate::kong_backend::KongBackend;

impl KongBackend {
    pub async fn remove_liquidity(&self, remove_liquidity_args: &RemoveLiquidityArgs) -> Result<RemoveLiquidityReply> {
        // kong_backend remove_liquidity
        let result = self
            .agent
            .update(&self.principal_id, "remove_liquidity")
            .with_arg(Encode!(&remove_liquidity_args)?)
            .await?;
        let remove_liquidity_result = Decode!(result.as_slice(), Result<RemoveLiquidityReply, String>)?;
        remove_liquidity_result.map_err(|e| anyhow::anyhow!(e))
    }

    #[allow(dead_code)]
    pub async fn remove_liquidity_async(&self, remove_liquidity_args: &RemoveLiquidityArgs) -> Result<u64> {
        // kong_backend remove_liquidity_async
        let result = self
            .agent
            .update(&self.principal_id, "remove_liquidity_async")
            .with_arg(Encode!(&remove_liquidity_args)?)
            .await?;
        let request_id = Decode!(result.as_slice(), Result<u64, String>)?;
        request_id.map_err(|e| anyhow::anyhow!(e))
    }
}
