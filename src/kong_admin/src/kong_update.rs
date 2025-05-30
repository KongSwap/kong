use anyhow::Result;

pub trait KongUpdate {
    #[allow(dead_code)]
    async fn update_kong_settings(&self, kong_settings: &str) -> Result<String>;
    async fn update_users(&self, users: &str) -> Result<String>;
    async fn update_tokens(&self, tokens: &str) -> Result<String>;
    async fn update_pools(&self, pools: &str) -> Result<String>;
    async fn update_lp_tokens(&self, lp_tokens: &str) -> Result<String>;
    async fn update_claims(&self, claims: &str) -> Result<String>;
    async fn update_requests(&self, requests: &str) -> Result<String>;
    async fn update_transfers(&self, txs: &str) -> Result<String>;
    async fn update_txs(&self, txs: &str) -> Result<String>;
}
