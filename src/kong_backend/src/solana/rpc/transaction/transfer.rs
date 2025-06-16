use anyhow::Result;
use candid::Principal;

use crate::solana::rpc::client::SolanaRpcClient;

impl SolanaRpcClient {
    /// Transfer SOL token
    ///
    /// # Arguments
    ///
    /// * `from_address` - The sender's address
    /// * `to_address` - The recipient's address
    /// * `fee_payer` - The address that will pay the transaction fee
    /// * `lamports` - The amount of lamports to transfer
    /// * `memo` - Optional memo to include in the transaction
    ///
    /// # Returns
    ///
    /// The transaction signature
    pub async fn transfer_sol(
        &self,
        from_address: &Principal,
        to_address: &str,
        fee_payer: Option<&str>,
        lamports: u64,
        memo: Option<String>,
    ) -> Result<String> {
        let from_address_str = from_address.to_text();
        // Default to from_address if fee_payer is not provided
        let fee_payer = fee_payer.unwrap_or(&from_address_str);

        // Create transaction builder and build the instructions
        let instructions = self
            .build_transfer_sol_transaction(&from_address_str, to_address, fee_payer, lamports, memo)
            .await?;

        self.submit_transaction(from_address, instructions, fee_payer).await
    }

    /// Transfer SPL token
    ///
    /// # Arguments
    ///
    /// * `from_address` - The sender's wallet address
    /// * `to_address` - The recipient's wallet address
    /// * `mint_address` - The token mint address
    /// * `fee_payer` - The address that will pay the transaction fee
    /// * `amount` - The amount of tokens to transfer (in smallest units)
    /// * [memo](cci:1://file:///home/dev/kongswap/earn/src/kong_earn_backend/src/multichain/solana/transaction/builder.rs:196:4-226:5) - Optional memo to include in the transaction
    ///
    /// # Returns
    ///
    /// The transaction signature
    pub async fn transfer_spl(
        &self,
        from_address: &Principal,
        to_address: &str,
        mint_address: &str,
        fee_payer: Option<&str>,
        amount: u64,
        memo: Option<String>,
    ) -> Result<String> {
        let from_address_str = from_address.to_string();
        // Default to from_address if fee_payer is not provided
        let fee_payer = fee_payer.unwrap_or(&from_address_str);

        // Find or derive the sender's token account
        let from_token_account = self.derive_associated_token_account(&from_address_str, mint_address)?;
        // Find or create the recipient's token account
        let to_token_account = self
            .create_associated_token_account(from_address, to_address, mint_address, fee_payer)
            .await?;

        // Create transaction builder and build the instructions
        let instructions = self
            .build_transfer_spl_transaction(&from_address_str, &from_token_account, &to_token_account, fee_payer, amount, memo)
            .await?;

        self.submit_transaction(from_address, instructions, fee_payer).await
    }
}
