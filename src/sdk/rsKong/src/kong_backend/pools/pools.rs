use anyhow::Result;
use candid::{Decode, Encode};

use super::pools_reply::PoolsReply;

use crate::kong_backend::KongBackend;

impl KongBackend {
    #[allow(dead_code)]
    pub async fn pools(&self, symbol: Option<&str>) -> Result<Vec<PoolsReply>> {
        let results = self
            .agent
            .query(&self.principal_id, "pools")
            .with_arg(Encode!(&symbol)?)
            .await?;
        Decode!(results.as_slice(), Result<Vec<PoolsReply>, String>)?.map_err(|e| anyhow::anyhow!(e))
    }
}
