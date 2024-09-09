use anyhow::Result;
use candid::{Decode, Encode, Principal};
use ic_agent::Agent;
use icrc_ledger_types::icrc1::account::Account;

pub mod add_liquidity;
mod canister;
pub mod claim;
pub mod helpers;
pub mod pools;
pub mod remove_liquidity;
pub mod requests;
pub mod swap;
pub mod swap_amounts;
pub mod tokens;

const KONG_BACKEND: &str = "l4lgk-raaaa-aaaar-qahpq-cai";

#[derive(Clone)]
pub struct KongBackend {
    agent: Agent,
    principal_id: Principal,
    backend_id: Account,
}

impl KongBackend {
    pub fn new(agent: &Agent) -> Self {
        let principal_id = Principal::from_text(KONG_BACKEND).unwrap();
        KongBackend {
            agent: agent.clone(),
            principal_id,
            backend_id: Account::from(principal_id),
        }
    }

    pub async fn icrc1_name(&self) -> Result<String> {
        let icrc1_name = self
            .agent
            .query(&self.principal_id, "icrc1_name")
            .with_arg(Encode!()?)
            .await?;
        Ok(Decode!(icrc1_name.as_slice(), String)?)
    }

    pub async fn version(&self) -> Result<String> {
        let version = self
            .agent
            .query(&self.principal_id, "version")
            .with_arg(Encode!()?)
            .await?;
        Ok(Decode!(version.as_slice(), String)?)
    }

    pub async fn whoami(&self) -> Result<String> {
        let whoami = self
            .agent
            .query(&self.principal_id, "whoami")
            .with_arg(Encode!()?)
            .await?;
        Ok(Decode!(whoami.as_slice(), String)?)
    }
}
