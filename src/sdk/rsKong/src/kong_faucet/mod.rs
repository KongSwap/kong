use anyhow::Result;
use candid::{Decode, Encode, Principal};
use ic_agent::Agent;

const KONG_FAUCET: &str = "ohr23-xqaaa-aaaar-qahqq-cai";

pub struct KongFaucet {
    agent: Agent,
    principal: Principal,
}

impl KongFaucet {
    pub fn new(agent: &Agent) -> Self {
        KongFaucet {
            agent: agent.clone(),
            principal: Principal::from_text(KONG_FAUCET).unwrap(),
        }
    }

    pub async fn claim(&self) -> Result<String> {
        let results = self.agent.update(&self.principal, "claim").with_arg(Encode!()?).await?;
        Decode!(results.as_slice(), Result<String, String>)?.map_err(|e| anyhow::anyhow!(e))
    }
}
