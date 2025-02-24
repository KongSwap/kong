use candid::{CandidType, Nat, Principal};
use serde::{Deserialize, Serialize};
use icrc_ledger_types::icrc1::transfer::{BlockIndex, TransferError};
use icrc_ledger_types::icrc1::account::Account;
use serde_bytes::ByteBuf;

#[derive(CandidType, Deserialize)]
pub enum TransferResult {
    Ok(BlockIndex),
    Err(TransferError),
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct TokenInfo {
    pub name: String,
    pub ticker: String,
    pub total_supply: u64,
    pub ledger_id: Option<Principal>,
    pub logo: Option<String>,
    pub decimals: u8,
    pub transfer_fee: u64,
    pub archive_options: Option<ArchiveOptions>,
}

#[derive(CandidType, Serialize, Deserialize)]
pub struct TokenInitArgs {
    pub name: String,
    pub ticker: String,
    pub total_supply: u64,
    pub logo: Option<String>,
    pub decimals: Option<u8>,
    pub transfer_fee: Option<u64>,
    pub archive_options: Option<ArchiveOptions>,
    pub block_time_target_seconds: u64,
    pub halving_interval: u64,
}

#[derive(CandidType, Serialize, Deserialize)]
pub enum MetadataValue {
    Nat(Nat),
    Int(candid::Int),
    Text(String),
    Blob(ByteBuf),
}

#[derive(CandidType, Serialize, Deserialize)]
pub struct FeatureFlags {
    pub icrc2: bool,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct ArchiveOptions {
    pub num_blocks_to_archive: u64,
    pub max_transactions_per_response: Option<u64>,
    pub trigger_threshold: u64,
    pub max_message_size_bytes: Option<u64>,
    pub cycles_for_archive_creation: Option<u64>,
    pub node_max_memory_size_bytes: Option<u64>,
    pub controller_id: Principal,
    pub more_controller_ids: Option<Vec<Principal>>,
}

#[derive(CandidType, Serialize, Deserialize)]
pub struct InitArgs {
    pub minting_account: Account,
    pub fee_collector_account: Option<Account>,
    pub transfer_fee: Nat,
    pub decimals: Option<u8>,
    pub max_memo_length: Option<u16>,
    pub token_symbol: String,
    pub token_name: String,
    pub metadata: Vec<(String, MetadataValue)>,
    pub initial_balances: Vec<(Account, Nat)>,
    pub feature_flags: Option<FeatureFlags>,
    pub maximum_number_of_accounts: Option<u64>,
    pub accounts_overflow_trim_quantity: Option<u64>,
    pub archive_options: ArchiveOptions,
}

#[derive(CandidType, Serialize, Deserialize)]
pub enum LedgerArg {
    Init(InitArgs),
    Upgrade(Option<UpgradeArgs>),
}

#[derive(CandidType, Serialize, Deserialize)]
pub enum ChangeFeeCollector {
    Unset,
    SetTo(Account),
}

#[derive(CandidType, Serialize, Deserialize)]
pub struct ChangeArchiveOptions {
    pub num_blocks_to_archive: Option<u64>,
    pub max_transactions_per_response: Option<u64>,
    pub trigger_threshold: Option<u64>,
    pub max_message_bytes: Option<u64>,
    pub cycles_for_archive_creation: Option<u64>,
    pub node_max_memory_size_bytes: Option<u64>,
    pub controller_id: Option<Principal>,
    pub more_controller_ids: Option<Vec<Principal>>,
}

#[derive(CandidType, Serialize, Deserialize)]
pub struct UpgradeArgs {
    pub metadata: Option<Vec<(String, MetadataValue)>>,
    pub token_symbol: Option<String>,
    pub token_name: Option<String>,
    pub transfer_fee: Option<Nat>,
    pub change_fee_collector: Option<ChangeFeeCollector>,
    pub max_memo_length: Option<u16>,
    pub feature_flags: Option<FeatureFlags>,
    pub accounts_overflow_trim_quantity: Option<u64>,
    pub change_archive_options: Option<ChangeArchiveOptions>,
}
    
#[derive(CandidType, Serialize, Deserialize)]
pub struct MiningInfo {
    pub current_difficulty: u32,
    pub current_block_reward: u64,
    pub block_time_target: u64,
    pub next_halving_interval: u64,
    pub mining_complete: bool,
} 
