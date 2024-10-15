#![allow(dead_code)]

use anyhow::Result;
use candid::{Decode, Encode, Nat, Principal};
use icrc_ledger_types::icrc1::transfer::TransferArg;

use super::swap_args::SwapArgs;
use super::swap_reply::SwapReply;

use crate::kong_backend::tokens::token::Token;
use crate::kong_backend::transfers::tx_id::TxId;
use crate::kong_backend::KongBackend;

impl KongBackend {
    pub async fn swap_transfer(&self, swap_args: &SwapArgs) -> Result<SwapReply> {
        // icrc1_transfer for pay token
        let pay_token = self
            .tokens
            .iter()
            .find(|token| token.symbol() == swap_args.pay_token)
            .ok_or(anyhow::anyhow!("Pay token not found"))?;
        let pay_amount = swap_args.pay_amount.clone();
        let pay_token_ledger = Principal::from_text(pay_token.address())?;
        let transfer_args = TransferArg {
            from_subaccount: None,
            to: self.account_id,
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
        let pay_tx_id = TxId::BlockIndex(transfer_results.map_err(|e| anyhow::anyhow!(e))?);

        // kong_backend swap
        let mut swap_args = swap_args.clone();
        swap_args.pay_tx_id = Some(pay_tx_id); // pass the tx_id from the above icrc1_transfer
        let result = self
            .agent
            .update(&self.principal_id, "swap")
            .with_arg(Encode!(&swap_args)?)
            .await?;
        let swap_result = Decode!(result.as_slice(), Result<SwapReply, String>)?;
        swap_result.map_err(|e| anyhow::anyhow!(e))
    }

    pub async fn swap_transfer_async(&self, swap_args: &SwapArgs) -> Result<u64> {
        // icrc1_transfer for pay token
        let pay_token = self
            .tokens
            .iter()
            .find(|token| token.symbol() == swap_args.pay_token)
            .ok_or(anyhow::anyhow!("Pay token not found"))?;
        let pay_amount = swap_args.pay_amount.clone();
        let pay_token_ledger = Principal::from_text(pay_token.address())?;
        let transfer_args = TransferArg {
            from_subaccount: None,
            to: self.account_id,
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
        let pay_tx_id = TxId::BlockIndex(transfer_results.map_err(|e| anyhow::anyhow!(e))?);

        // kong_backend swap
        let mut swap_args = swap_args.clone();
        swap_args.pay_tx_id = Some(pay_tx_id); // pass the  from the above icrc1_transfer
        let result = self
            .agent
            .update(&self.principal_id, "swap_async")
            .with_arg(Encode!(&swap_args)?)
            .await?;
        let request_id = Decode!(result.as_slice(), Result<u64, String>)?;
        request_id.map_err(|e| anyhow::anyhow!(e))
    }
}
