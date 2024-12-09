use anyhow::Result;
use candid::{Decode, Encode};

use super::token::Token;
use super::tokens_reply::TokensReply;

use crate::kong_backend::KongBackend;

impl KongBackend {
    pub async fn tokens(&mut self, symbol: Option<&str>) -> Result<Vec<TokensReply>> {
        let results = self
            .agent
            .query(&self.principal_id, "tokens")
            .with_arg(Encode!(&symbol)?)
            .await?;
        let tokens = Decode!(results.as_slice(), Result<Vec<TokensReply>, String>)?.map_err(|e| anyhow::anyhow!(e));
        if let Ok(ref t) = tokens {
            self.tokens = t.clone();
        }
        tokens
    }

    pub fn token(&self, symbol: &str) -> Option<&TokensReply> {
        self.tokens.iter().find(|token| token.symbol() == symbol)
    }
}
