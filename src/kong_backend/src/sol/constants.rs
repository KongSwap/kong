/// Solana Constants Module
/// Contains constants and configuration values for Solana integration

// RPC endpoint configurations
pub const SOLANA_MAINNET_RPC: &str = "https://api.mainnet-beta.solana.com";
pub const SOLANA_DEVNET_RPC: &str = "https://api.devnet.solana.com";
pub const SOLANA_TESTNET_RPC: &str = "https://api.testnet.solana.com";

// Default transaction parameters
pub const SOLANA_DEFAULT_CONFIRM_TIMEOUT_MS: u64 = 30000; // 30 seconds
pub const SOLANA_DEFAULT_PREFLIGHT_COMMITMENT: &str = "confirmed";

// Token and transaction constants
pub const SOLANA_DECIMALS: u8 = 9; // Native SOL has 9 decimals
pub const SOLANA_LAMPORTS_PER_SOL: u64 = 1_000_000_000; // 10^9 lamports = 1 SOL

// System program and special accounts
pub const SOLANA_SYSTEM_PROGRAM_ID: &str = "11111111111111111111111111111111";
pub const SOLANA_TOKEN_PROGRAM_ID: &str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
pub const SOLANA_ASSOCIATED_TOKEN_PROGRAM_ID: &str = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";

// Internet Computer Threshold Schnorr integration
pub const SOLANA_SIGNATURE_TYPE: &str = "ed25519"; // Signature type for Solana (Ed25519)