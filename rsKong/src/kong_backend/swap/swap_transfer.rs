use super::swap_args::SwapArgs;
use super::swap_reply::SwapReply;
use crate::kong_backend::tokens::address::Address;
use crate::kong_backend::tokens::symbol::Symbol;
use crate::kong_backend::tokens::tokens_reply::TokensReply;
use crate::kong_backend::KongBackend;
use anyhow::Result;
use candid::{Decode, Encode, Nat, Principal};
use icrc_ledger_types::icrc1::transfer::TransferArg;

impl KongBackend {
    // swap() using icrc1_transfer()
    pub async fn swap_transfer(&self, swap_args: &SwapArgs, tokens: &[TokensReply]) -> Result<SwapReply> {
        // icrc1_transfer for pay token
        let pay_token = tokens
            .iter()
            .find(|token| token.symbol() == swap_args.pay_token)
            .ok_or(anyhow::anyhow!("Pay token not found"))?;
        let pay_amount = swap_args.pay_amount.clone();
        let pay_token_ledger =
            Principal::from_text(&pay_token.address().ok_or(anyhow::anyhow!("Invalid pay principal id"))?)?;
        let transfer_args = TransferArg {
            from_subaccount: None,
            to: self.backend_id,
            amount: pay_amount.clone(),
            fee: None,
            memo: None,
            created_at_time: None,
        };
        let result = self
            .agent
            .update(&pay_token_ledger, "icrc1_transfer")
            .with_arg(Encode!(&transfer_args)?)
            .await?;
        let transfer_results = Decode!(result.as_slice(), Result<Nat, String>)?;
        let pay_block_id = transfer_results.map_err(|e| anyhow::anyhow!(e))?;

        // kong_backend swap
        let mut swap_args = swap_args.clone();
        swap_args.pay_block_id = Some(pay_block_id); // pass the block_id from the above icrc1_transfer
        let result = self
            .agent
            .update(&self.principal_id, "swap")
            .with_arg(Encode!(&swap_args)?)
            .await?;
        let swap_result = Decode!(result.as_slice(), Result<SwapReply, String>)?;
        swap_result.map_err(|e| anyhow::anyhow!(e))
    }

    pub async fn swap_transfer_async(&self, swap_args: &SwapArgs, tokens: &[TokensReply]) -> Result<u64> {
        // icrc1_transfer for pay token
        let pay_token = tokens
            .iter()
            .find(|token| token.symbol() == swap_args.pay_token)
            .ok_or(anyhow::anyhow!("Pay token not found"))?;
        let pay_amount = swap_args.pay_amount.clone();
        let pay_token_ledger =
            Principal::from_text(&pay_token.address().ok_or(anyhow::anyhow!("Invalid pay principal id"))?)?;
        let transfer_args = TransferArg {
            from_subaccount: None,
            to: self.backend_id,
            amount: pay_amount.clone(),
            fee: None,
            memo: None,
            created_at_time: None,
        };
        let result = self
            .agent
            .update(&pay_token_ledger, "icrc1_transfer")
            .with_arg(Encode!(&transfer_args)?)
            .await?;
        let transfer_results = Decode!(result.as_slice(), Result<Nat, String>)?;
        let pay_block_id = transfer_results.map_err(|e| anyhow::anyhow!(e))?;

        // kong_backend swap
        let mut swap_args = swap_args.clone();
        swap_args.pay_block_id = Some(pay_block_id); // pass the  from the above icrc1_transfer
        let result = self
            .agent
            .update(&self.principal_id, "swap_async")
            .with_arg(Encode!(&swap_args)?)
            .await?;
        let request_id = Decode!(result.as_slice(), Result<u64, String>)?;
        request_id.map_err(|e| anyhow::anyhow!(e))
    }
}
