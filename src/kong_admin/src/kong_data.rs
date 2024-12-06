use anyhow::Result;
use candid::{Decode, Encode, Principal};
use ic_agent::Agent;

use super::kong_update::KongUpdate;

const KONG_DATA_LOCAL: &str = "cbefx-hqaaa-aaaar-qakrq-cai";
const KONG_DATA_PROD: &str = "cbefx-hqaaa-aaaar-qakrq-cai";

#[derive(Clone)]
pub struct KongData {
    agent: Agent,
    canister_id: Principal,
}

impl KongData {
    pub async fn new(agent: &Agent, is_mainnet: bool) -> Self {
        let canister_id = if is_mainnet {
            Principal::from_text(KONG_DATA_PROD).unwrap()
        } else {
            Principal::from_text(KONG_DATA_LOCAL).unwrap()
        };
        KongData {
            agent: agent.clone(),
            canister_id,
        }
    }

    #[allow(dead_code)]
    pub async fn icrc1_name(&self) -> Result<String> {
        let icrc1_name = self.agent.query(&self.canister_id, "icrc1_name").with_arg(Encode!()?).await?;
        Ok(Decode!(icrc1_name.as_slice(), String)?)
    }

    #[allow(dead_code)]
    pub async fn backup_updates(&self, update_id: Option<u64>) -> Result<String> {
        let result = self
            .agent
            .query(&self.canister_id, "backup_updates")
            .with_arg(Encode!(&update_id)?)
            .await?;
        let call_result = Decode!(result.as_slice(), Result<String, String>)?;
        call_result.map_err(|e| anyhow::anyhow!(e))
    }
}

impl KongUpdate for KongData {
    #[allow(dead_code)]
    async fn update_kong_settings(&self, kong_settings: &str) -> Result<String> {
        let result: Vec<u8> = self
            .agent
            .update(&self.canister_id, "update_kong_settings")
            .with_arg(Encode!(&kong_settings)?)
            .await?;
        let call_result = Decode!(result.as_slice(), Result<String, String>)?;
        call_result.map_err(|e| anyhow::anyhow!(e))
    }

    #[allow(dead_code)]
    async fn update_users(&self, users: &str) -> Result<String> {
        let result = self
            .agent
            .update(&self.canister_id, "update_users")
            .with_arg(Encode!(&users)?)
            .await?;
        let call_result = Decode!(result.as_slice(), Result<String, String>)?;
        call_result.map_err(|e| anyhow::anyhow!(e))
    }

    #[allow(dead_code)]
    async fn update_tokens(&self, tokens: &str) -> Result<String> {
        let result = self
            .agent
            .update(&self.canister_id, "update_tokens")
            .with_arg(Encode!(&tokens)?)
            .await?;
        let call_result = Decode!(result.as_slice(), Result<String, String>)?;
        call_result.map_err(|e| anyhow::anyhow!(e))
    }

    #[allow(dead_code)]
    async fn update_pools(&self, pools: &str) -> Result<String> {
        let result = self
            .agent
            .update(&self.canister_id, "update_pools")
            .with_arg(Encode!(&pools)?)
            .await?;
        let call_result = Decode!(result.as_slice(), Result<String, String>)?;
        call_result.map_err(|e| anyhow::anyhow!(e))
    }

    #[allow(dead_code)]
    async fn update_lp_tokens(&self, lp_token_ledgers: &str) -> Result<String> {
        let result = self
            .agent
            .update(&self.canister_id, "update_lp_tokens")
            .with_arg(Encode!(&lp_token_ledgers)?)
            .await?;
        let call_result = Decode!(result.as_slice(), Result<String, String>)?;
        call_result.map_err(|e| anyhow::anyhow!(e))
    }

    #[allow(dead_code)]
    async fn update_claims(&self, claims: &str) -> Result<String> {
        let result = self
            .agent
            .update(&self.canister_id, "update_claims")
            .with_arg(Encode!(&claims)?)
            .await?;
        let call_result = Decode!(result.as_slice(), Result<String, String>)?;
        call_result.map_err(|e| anyhow::anyhow!(e))
    }

    #[allow(dead_code)]
    async fn update_requests(&self, requests: &str) -> Result<String> {
        let result = self
            .agent
            .update(&self.canister_id, "update_requests")
            .with_arg(Encode!(&requests)?)
            .await?;
        let call_result = Decode!(result.as_slice(), Result<String, String>)?;
        call_result.map_err(|e| anyhow::anyhow!(e))
    }

    #[allow(dead_code)]
    async fn update_transfers(&self, txs: &str) -> Result<String> {
        let result = self
            .agent
            .update(&self.canister_id, "update_transfers")
            .with_arg(Encode!(&txs)?)
            .await?;
        let call_result = Decode!(result.as_slice(), Result<String, String>)?;
        call_result.map_err(|e| anyhow::anyhow!(e))
    }

    #[allow(dead_code)]
    async fn update_txs(&self, txs: &str) -> Result<String> {
        let result = self.agent.update(&self.canister_id, "update_txs").with_arg(Encode!(&txs)?).await?;
        let call_result = Decode!(result.as_slice(), Result<String, String>)?;
        call_result.map_err(|e| anyhow::anyhow!(e))
    }

    #[allow(dead_code)]
    async fn update_message(&self, message: &str) -> Result<String> {
        let result = self
            .agent
            .update(&self.canister_id, "update_message")
            .with_arg(Encode!(&message)?)
            .await?;
        let call_result = Decode!(result.as_slice(), Result<String, String>)?;
        call_result.map_err(|e| anyhow::anyhow!(e))
    }
}
