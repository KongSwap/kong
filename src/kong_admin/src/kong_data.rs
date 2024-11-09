use anyhow::Result;
use candid::{Decode, Encode, Principal};
use ic_agent::Agent;

const KONG_BACKEND_STAGING: &str = "bd3sg-teaaa-aaaaa-qaaba-cai";
const KONG_BACKEND_PROD: &str = "cbefx-hqaaa-aaaar-qakrq-cai";

#[derive(Clone)]
pub struct KongData {
    agent: Agent,
    canister_id: Principal,
}

impl KongData {
    pub async fn new(agent: &Agent, is_mainnet: bool) -> Self {
        let canister_id = if is_mainnet {
            Principal::from_text(KONG_BACKEND_PROD).unwrap()
        } else {
            Principal::from_text(KONG_BACKEND_STAGING).unwrap()
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
    pub async fn archive_kong_settings(&self, kong_settings: &String) -> Result<String> {
        let result = self
            .agent
            .update(&self.canister_id, "archive_kong_settings")
            .with_arg(Encode!(&kong_settings)?)
            .await?;
        let call_result = Decode!(result.as_slice(), Result<String, String>)?;
        call_result.map_err(|e| anyhow::anyhow!(e))
    }

    #[allow(dead_code)]
    pub async fn archive_users(&self, users: &String) -> Result<String> {
        let result = self
            .agent
            .update(&self.canister_id, "archive_users")
            .with_arg(Encode!(&users)?)
            .await?;
        let call_result = Decode!(result.as_slice(), Result<String, String>)?;
        call_result.map_err(|e| anyhow::anyhow!(e))
    }

    #[allow(dead_code)]
    pub async fn archive_tokens(&self, tokens: &String) -> Result<String> {
        let result = self
            .agent
            .update(&self.canister_id, "archive_tokens")
            .with_arg(Encode!(&tokens)?)
            .await?;
        let call_result = Decode!(result.as_slice(), Result<String, String>)?;
        call_result.map_err(|e| anyhow::anyhow!(e))
    }

    #[allow(dead_code)]
    pub async fn archive_pools(&self, pools: &String) -> Result<String> {
        let result = self
            .agent
            .update(&self.canister_id, "archive_pools")
            .with_arg(Encode!(&pools)?)
            .await?;
        let call_result = Decode!(result.as_slice(), Result<String, String>)?;
        call_result.map_err(|e| anyhow::anyhow!(e))
    }

    #[allow(dead_code)]
    pub async fn archive_lp_token_ledger(&self, lp_token_ledgers: &String) -> Result<String> {
        let result = self
            .agent
            .update(&self.canister_id, "archive_lp_token_ledger")
            .with_arg(Encode!(&lp_token_ledgers)?)
            .await?;
        let call_result = Decode!(result.as_slice(), Result<String, String>)?;
        call_result.map_err(|e| anyhow::anyhow!(e))
    }

    #[allow(dead_code)]
    pub async fn archive_requests(&self, requests: &String) -> Result<String> {
        let result = self
            .agent
            .update(&self.canister_id, "archive_requests")
            .with_arg(Encode!(&requests)?)
            .await?;
        let call_result = Decode!(result.as_slice(), Result<String, String>)?;
        call_result.map_err(|e| anyhow::anyhow!(e))
    }

    #[allow(dead_code)]
    pub async fn archive_transfers(&self, txs: &String) -> Result<String> {
        let result = self
            .agent
            .update(&self.canister_id, "archive_transfers")
            .with_arg(Encode!(&txs)?)
            .await?;
        let call_result = Decode!(result.as_slice(), Result<String, String>)?;
        call_result.map_err(|e| anyhow::anyhow!(e))
    }

    #[allow(dead_code)]
    pub async fn archive_txs(&self, txs: &String) -> Result<String> {
        let result = self.agent.update(&self.canister_id, "archive_txs").with_arg(Encode!(&txs)?).await?;
        let call_result = Decode!(result.as_slice(), Result<String, String>)?;
        call_result.map_err(|e| anyhow::anyhow!(e))
    }
}
