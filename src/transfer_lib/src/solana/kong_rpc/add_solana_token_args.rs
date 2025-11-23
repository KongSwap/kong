use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};



/// Arguments for adding an SPL token (proxy-only).
/// 
/// This is used internally by the kong_rpc proxy during ATA discovery.
/// All metadata is fetched from Solana and provided by the proxy.
#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct AddSolanaTokenArgs {
    /// SPL token address (format: SOL.MintAddress)
    pub token: String,
    /// Token name (from Solana metadata)
    pub name: String,
    /// Token symbol (from Solana metadata)
    pub symbol: String,
    /// Token decimals (from Solana metadata)
    pub decimals: u8,
    /// Transaction fee in lamports (defaults to 5000)
    pub fee: Option<Nat>,
    /// Solana program ID (from Solana metadata)
    pub program_id: String,
}
