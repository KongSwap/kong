use super::tokens_reply::TokensReply;
use crate::kong_backend::KongBackend;
use anyhow::Result;
use candid::{Decode, Encode};

impl KongBackend {
    pub async fn tokens(&self, symbol: Option<&str>) -> Result<Vec<TokensReply>> {
        let results = self
            .agent
            .query(&self.principal_id, "tokens")
            .with_arg(Encode!(&symbol)?)
            .await?;
        Decode!(results.as_slice(), Result<Vec<TokensReply>, String>)?.map_err(|e| anyhow::anyhow!(e))
    }
}
