use anyhow::Result;
use candid::{Decode, Encode, Principal};
use ic_agent::Agent;
use icrc_ledger_types::icrc1::account::Account;
use tokens::tokens_reply::TokensReply;

pub mod add_liquidity;
pub mod add_liquidity_amounts;
mod canister;
pub mod claim;
pub mod helpers;
pub mod pools;
pub mod remove_liquidity;
pub mod remove_liquidity_amounts;
pub mod requests;
pub mod swap;
pub mod swap_amounts;
pub mod tokens;
pub mod transfers;

const KONG_BACKEND_STAGING: &str = "l4lgk-raaaa-aaaar-qahpq-cai";
const KONG_BACKEND_PROD: &str = "2ipq2-uqaaa-aaaar-qailq-cai";

#[derive(Clone)]
pub struct KongBackend {
    agent: Agent,
    principal_id: Principal,
    account_id: Account,
    tokens: Vec<TokensReply>,
}

impl KongBackend {
    pub async fn new(agent: &Agent, is_prod: bool) -> Self {
        let principal_id = if is_prod {
            Principal::from_text(KONG_BACKEND_PROD).unwrap()
        } else {
            Principal::from_text(KONG_BACKEND_STAGING).unwrap()
        };
        let mut instance = KongBackend {
            agent: agent.clone(),
            principal_id,
            account_id: Account::from(principal_id),
            tokens: Vec::new(),
        };
        _ = instance.tokens(None).await; // populate tokens
        instance
    }

    #[allow(dead_code)]
    pub async fn icrc1_name(&self) -> Result<String> {
        let icrc1_name = self
            .agent
            .query(&self.principal_id, "icrc1_name")
            .with_arg(Encode!()?)
            .await?;
        Ok(Decode!(icrc1_name.as_slice(), String)?)
    }
}
