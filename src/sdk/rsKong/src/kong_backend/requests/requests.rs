use super::requests_reply::RequestsReply;
use crate::kong_backend::KongBackend;
use anyhow::Result;
use candid::{Decode, Encode};

impl KongBackend {
    // the default swap() function
    pub async fn requests(&self, request_id: Option<u64>) -> Result<Vec<RequestsReply>> {
        let result = self
            .agent
            .query(&self.principal_id, "requests")
            .with_arg(Encode!(&request_id)?)
            .await?;
        let requests = Decode!(result.as_slice(), Result<Vec<RequestsReply>, String>)?;
        requests.map_err(|e| anyhow::anyhow!(e))
    }
}
