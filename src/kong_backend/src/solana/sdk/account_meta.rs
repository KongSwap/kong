/// Account metadata for transaction instructions
#[derive(Debug, Default, PartialEq, Eq, Clone)]
pub struct AccountMeta {
    /// The account's public key
    pub pubkey: String,

    /// Whether the account is a signer
    pub is_signer: bool,
    
    /// Whether the account is writable
    pub is_writable: bool,
}
