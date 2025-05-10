use super::account_meta::AccountMeta;

#[derive(Debug, PartialEq, Eq, Clone)]
pub struct Instruction {
    /// Program ID that will execute this instruction
    pub program_id: String,
    /// Accounts required for this instruction
    pub accounts: Vec<AccountMeta>,
    /// Instruction data
    pub data: Vec<u8>,
}