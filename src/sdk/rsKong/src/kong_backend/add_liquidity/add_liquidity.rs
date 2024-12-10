use anyhow::Result;
use candid::{Decode, Encode, Nat, Principal};
use icrc_ledger_types::icrc2::approve::ApproveArgs;
use std::time::SystemTime;

use super::add_liquidity_args::AddLiquidityArgs;
use super::add_liquidity_reply::AddLiquidityReply;

use crate::kong_backend::helpers::nat_helpers::nat_add;
use crate::kong_backend::tokens::token::Token;
use crate::kong_backend::KongBackend;

impl KongBackend {
    pub async fn add_liquidity(&self, add_liquidity_args: &AddLiquidityArgs) -> Result<AddLiquidityReply> {
        // icrc2_approve for token_0
        let token_0 = self
            .tokens
            .iter()
            .find(|token| token.symbol() == add_liquidity_args.token_0)
            .ok_or(anyhow::anyhow!("Token 0 not found"))?;
        // include the gas fee for pay token in the icrc2_approve amount. Note, it will also require gas fee for the icrc2_approve transaction
        let amount = nat_add(&add_liquidity_args.amount_0, &token_0.fee());
        let token_ledger = Principal::from_text(token_0.address())?;
        let ts_now = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH)?.as_nanos() as u64;
        let expires_at = ts_now + 60_000_000_000_u64; // add 60 seconds
        let approve_args = ApproveArgs {
            from_subaccount: None,
            spender: self.account_id,
            amount: amount.clone(),
            expected_allowance: None,
            expires_at: Some(expires_at),
            fee: None,
            memo: None,
            created_at_time: None,
        };
        let result = self
            .agent
            .update(&token_ledger, "icrc2_approve")
            .with_arg(Encode!(&approve_args)?)
            .await?;
        let approve_results = Decode!(result.as_slice(), Result<Nat, String>)?;
        let _ = approve_results.map_err(|e| anyhow::anyhow!(e))?;

        // icrc2_approve for token_1
        let token_1 = self
            .tokens
            .iter()
            .find(|token| token.symbol() == add_liquidity_args.token_1)
            .ok_or(anyhow::anyhow!("Token 1 not found"))?;
        // include the gas fee for pay token in the icrc2_approve amount. Note, it will also require gas fee for the icrc2_approve transaction
        let amount = nat_add(&add_liquidity_args.amount_1, &token_1.fee());
        let token_ledger = Principal::from_text(token_1.address())?;
        let ts_now = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH)?.as_nanos() as u64;
        let expires_at = ts_now + 60_000_000_000_u64; // add 60 seconds
        let approve_args = ApproveArgs {
            from_subaccount: None,
            spender: self.account_id,
            amount: amount.clone(),
            expected_allowance: None,
            expires_at: Some(expires_at),
            fee: None,
            memo: None,
            created_at_time: None,
        };
        let result = self
            .agent
            .update(&token_ledger, "icrc2_approve")
            .with_arg(Encode!(&approve_args)?)
            .await?;
        let approve_results = Decode!(result.as_slice(), Result<Nat, String>)?;
        let _ = approve_results.map_err(|e| anyhow::anyhow!(e))?;

        // kong_backend add_liquidity
        let result = self
            .agent
            .update(&self.principal_id, "add_liquidity")
            .with_arg(Encode!(&add_liquidity_args)?)
            .await?;
        let add_liquidity_result = Decode!(result.as_slice(), Result<AddLiquidityReply, String>)?;
        add_liquidity_result.map_err(|e| anyhow::anyhow!(e))
    }

    #[allow(dead_code)]
    pub async fn add_liquidity_async(&self, add_liquidity_args: &AddLiquidityArgs) -> Result<u64> {
        // icrc2_approve for token_0
        let token_0 = self
            .tokens
            .iter()
            .find(|token| token.symbol() == add_liquidity_args.token_0)
            .ok_or(anyhow::anyhow!("Token 0 not found"))?;
        // include the gas fee for pay token in the icrc2_approve amount. Note, it will also require gas fee for the icrc2_approve transaction
        let amount = nat_add(&add_liquidity_args.amount_0, &token_0.fee());
        let token_ledger = Principal::from_text(token_0.address())?;
        let ts_now = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH)?.as_nanos() as u64;
        let expires_at = ts_now + 60_000_000_000_u64; // add 60 seconds
        let approve_args = ApproveArgs {
            from_subaccount: None,
            spender: self.account_id,
            amount: amount.clone(),
            expected_allowance: None,
            expires_at: Some(expires_at),
            fee: None,
            memo: None,
            created_at_time: None,
        };
        let result = self
            .agent
            .update(&token_ledger, "icrc2_approve")
            .with_arg(Encode!(&approve_args)?)
            .await?;
        let approve_results = Decode!(result.as_slice(), Result<Nat, String>)?;
        let _ = approve_results.map_err(|e| anyhow::anyhow!(e))?;

        // icrc2_approve for token_1
        let token_1 = self
            .tokens
            .iter()
            .find(|token| token.symbol() == add_liquidity_args.token_1)
            .ok_or(anyhow::anyhow!("Token 1 not found"))?;
        // include the gas fee for pay token in the icrc2_approve amount. Note, it will also require gas fee for the icrc2_approve transaction
        let amount = nat_add(&add_liquidity_args.amount_1, &token_1.fee());
        let token_ledger = Principal::from_text(token_1.address())?;
        let ts_now = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH)?.as_nanos() as u64;
        let expires_at = ts_now + 60_000_000_000_u64; // add 60 seconds
        let approve_args = ApproveArgs {
            from_subaccount: None,
            spender: self.account_id,
            amount: amount.clone(),
            expected_allowance: None,
            expires_at: Some(expires_at),
            fee: None,
            memo: None,
            created_at_time: None,
        };
        let result = self
            .agent
            .update(&token_ledger, "icrc2_approve")
            .with_arg(Encode!(&approve_args)?)
            .await?;
        let approve_results = Decode!(result.as_slice(), Result<Nat, String>)?;
        let _ = approve_results.map_err(|e| anyhow::anyhow!(e))?;

        // kong_backend add_liquidity_async
        let result = self
            .agent
            .update(&self.principal_id, "add_liquidity_async")
            .with_arg(Encode!(&add_liquidity_args)?)
            .await?;
        let request_id = Decode!(result.as_slice(), Result<u64, String>)?;
        request_id.map_err(|e| anyhow::anyhow!(e))
    }
}
