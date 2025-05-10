use anyhow::Result;

use crate::sol::network::SolanaNetwork;
use crate::sol::sdk::pubkey::SolanaPubkey; // Added import
use std::str::FromStr; // Added import

use super::client::SolanaRpcClient;

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
        from_address: &str,
        to_address: &str,
        _fee_payer: Option<&str>, // Original fee_payer, now unused by mock pathway
        lamports: u64,
        memo: Option<String>,
    ) -> Result<String> { // This is Result<String, anyhow::Error>
        // Default to from_address if fee_payer is not provided - fee_payer_str is unused by mocks
        // let fee_payer_str = fee_payer.unwrap_or(from_address);

        let from_pubkey = SolanaPubkey::from_str(from_address).map_err(|e| anyhow::anyhow!("Invalid from_address '{}': {}", from_address, e))?;
        let to_pubkey = SolanaPubkey::from_str(to_address).map_err(|e| anyhow::anyhow!("Invalid to_address '{}': {}", to_address, e))?;
        
        let instructions = self
            .build_transfer_sol_transaction(&from_pubkey, &to_pubkey, lamports, memo.as_deref());

        // The mock submit_transaction takes 1 arg and returns Result<String, SolanaError>
        self.submit_transaction(&instructions).await.map_err(|e| anyhow::anyhow!(e.to_string()))
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
    /// * `memo` - Optional memo to include in the transaction
    ///
    /// # Returns
    ///
    /// The transaction signature
    pub async fn transfer_spl(
        &self,
        from_address: &str, // This is the authority for the SPL transfer
        _to_address_wallet: &str, // Used to determine to_token_account, not directly by mock build
        mint_address: &str, 
        _fee_payer: Option<&str>, // Original fee_payer, now unused by mock pathway
        amount: u64,
        memo: Option<String>,
    ) -> Result<String> { // This is Result<String, anyhow::Error>
        // Default to from_address if fee_payer is not provided - fee_payer_str is unused by mocks
        // let fee_payer_str = fee_payer.unwrap_or(from_address);

        // These are used for the mock transaction string generation.
        // For real transactions, these would involve deriving/creating associated token accounts.
        let from_token_account_pubkey = SolanaPubkey::new([0u8; 32]); // Mock: Using a zeroed pubkey for simplicity
        let to_token_account_pubkey = SolanaPubkey::new([0u8; 32]);   // Mock: Using a zeroed pubkey for simplicity
        
        let mint_pubkey = SolanaPubkey::from_str(mint_address).map_err(|e| anyhow::anyhow!("Invalid mint_address '{}': {}", mint_address, e))?;
        let authority_pubkey = SolanaPubkey::from_str(from_address).map_err(|e| anyhow::anyhow!("Invalid authority_address (from_address) '{}': {}", from_address, e))?;

        let instructions = self
            .build_transfer_spl_transaction(
                &from_token_account_pubkey, 
                &to_token_account_pubkey,   
                &mint_pubkey,            
                &authority_pubkey,      
                amount,
                memo.as_deref(),
            );

        // The mock submit_transaction takes 1 arg and returns Result<String, SolanaError>
        self.submit_transaction(&instructions).await.map_err(|e| anyhow::anyhow!(e.to_string()))
    }

    pub async fn transfer_checked(
        &self,
        _from_address: &str,
        _mint_address: &str,
        _amount: u64,
        _decimals: u8,
    ) -> Result<String> {
        // Get the public key
        let to_address = SolanaNetwork::get_canister_public_key().await?;
        let _fee_payer = &to_address;

        // Find or derive the sender\'s token account
        // let from_token_account =
        //     self.derive_associated_token_account(from_address, mint_address)?;
        // Find or create the recipient\'s token account
        // let to_token_account = self
        //     .create_associated_token_account(&to_address, mint_address, fee_payer)
        //     .await?;

        // Create transaction builder and build the instructions
        // let instructions = self
        //     .build_transfer_checked_transaction(
        //         &from_token_account,
        //         &to_token_account,
        //         mint_address,
        //         &to_address,
        //         fee_payer,
        //         amount,
        //         decimals,
        //     )
        //     .await?;
        // self.submit_transaction(instructions, fee_payer).await
        Err(anyhow::anyhow!("transfer_checked is currently disabled due to missing RPC client methods"))
    }
}