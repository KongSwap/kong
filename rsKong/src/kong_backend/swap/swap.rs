use super::swap_args::SwapArgs;
use super::swap_reply::SwapReply;
use crate::kong_backend::helpers::nat_helpers::nat_add;
use crate::kong_backend::tokens::address::Address;
use crate::kong_backend::tokens::fee::Fee;
use crate::kong_backend::tokens::symbol::Symbol;
use crate::kong_backend::tokens::tokens_reply::TokensReply;
use crate::kong_backend::KongBackend;
use anyhow::Result;
use candid::{Decode, Encode, Nat, Principal};
use icrc_ledger_types::icrc2::approve::ApproveArgs;
use std::time::SystemTime;

impl KongBackend {
    // swap() using icrc2_approve() and then icrc2_transfer_from()
    pub async fn swap(&self, swap_args: &SwapArgs, tokens: &[TokensReply]) -> Result<SwapReply> {
        // icrc2_approve for pay token
        let pay_token = tokens
            .iter()
            .find(|token| token.symbol() == swap_args.pay_token)
            .ok_or(anyhow::anyhow!("Pay token not found"))?;
        // include the gas fee for pay token in the icrc2_approve amount. Note, it will also require gas fee for the icrc2_approve transaction
        let pay_amount = nat_add(&swap_args.pay_amount, &pay_token.fee());
        let pay_token_ledger =
            Principal::from_text(&pay_token.address().ok_or(anyhow::anyhow!("Invalid pay principal id"))?)?;
        let ts_now = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH)?.as_nanos() as u64;
        let expires_at = ts_now + 60_000_000_000_u64; // add 60 seconds
        let approve_args = ApproveArgs {
            from_subaccount: None,
            spender: self.backend_id,
            amount: pay_amount.clone(),
            expected_allowance: None,
            expires_at: Some(expires_at),
            fee: None,
            memo: None,
            created_at_time: None,
        };
        let result = self
            .agent
            .update(&pay_token_ledger, "icrc2_approve")
            .with_arg(Encode!(&approve_args)?)
            .await?;
        let approve_results = Decode!(result.as_slice(), Result<Nat, String>)?;
        let _ = approve_results.map_err(|e| anyhow::anyhow!(e))?;

        // kong_backend swap
        let swap_args = swap_args.clone();
        let result = self
            .agent
            .update(&self.principal_id, "swap")
            .with_arg(Encode!(&swap_args)?)
            .await?;
        let swap_result = Decode!(result.as_slice(), Result<SwapReply, String>)?;
        swap_result.map_err(|e| anyhow::anyhow!(e))
    }

    pub async fn swap_async(&self, swap_args: &SwapArgs, tokens: &[TokensReply]) -> Result<u64> {
        // icrc2_approve for pay token
        let pay_token = tokens
            .iter()
            .find(|token| token.symbol() == swap_args.pay_token)
            .ok_or(anyhow::anyhow!("Pay token not found"))?;
        // include the gas fee for pay token in the icrc2_approve amount. Note, it will also require gas fee for the icrc2_approve transaction
        let pay_amount = nat_add(&swap_args.pay_amount, &pay_token.fee());
        let pay_token_ledger =
            Principal::from_text(&pay_token.address().ok_or(anyhow::anyhow!("Invalid pay principal id"))?)?;
        let ts_now = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH)?.as_nanos() as u64;
        let expires_at = ts_now + 60_000_000_000_u64; // add 60 seconds
        let approve_args = ApproveArgs {
            from_subaccount: None,
            spender: self.backend_id,
            amount: pay_amount.clone(),
            expected_allowance: None,
            expires_at: Some(expires_at),
            fee: None,
            memo: None,
            created_at_time: None,
        };
        let result = self
            .agent
            .update(&pay_token_ledger, "icrc2_approve")
            .with_arg(Encode!(&approve_args)?)
            .await?;
        let approve_results = Decode!(result.as_slice(), Result<Nat, String>)?;
        let _ = approve_results.map_err(|e| anyhow::anyhow!(e))?;

        // kong_backend swap
        let swap_args = swap_args.clone();
        let result = self
            .agent
            .update(&self.principal_id, "swap_async")
            .with_arg(Encode!(&swap_args)?)
            .await?;
        let request_id = Decode!(result.as_slice(), Result<u64, String>)?;
        request_id.map_err(|e| anyhow::anyhow!(e))
    }

}
