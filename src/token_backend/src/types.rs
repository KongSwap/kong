use candid::{CandidType, Nat, Principal};
use serde::{Deserialize, Serialize};
use icrc_ledger_types::icrc1::transfer::{BlockIndex, TransferError};
use icrc_ledger_types::icrc1::account::Account;
use serde_bytes::ByteBuf;
use ic_stable_structures::{Storable, storable::Bound};
use std::borrow::Cow;

#[derive(CandidType, Deserialize)]
pub enum TransferResult {
    Ok(BlockIndex),
    Err(TransferError),
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct StorablePrincipal(pub Principal);

impl Storable for StorablePrincipal {
    fn to_bytes(&self) -> Cow<[u8]> {
        let principal_bytes = self.0.as_slice();
        let mut bytes = Vec::with_capacity(principal_bytes.len());
        bytes.extend_from_slice(principal_bytes);
        bytes.resize(32, 0);
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        let last_non_zero = bytes.iter()
            .rposition(|&b| b != 0)
            .map(|p| p + 1)
            .unwrap_or(0);
        
        Self(Principal::from_slice(&bytes[..last_non_zero]))
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 32,
        is_fixed_size: true,
    };
}

impl From<Principal> for StorablePrincipal {
    fn from(p: Principal) -> Self {
        Self(p)
    }
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
    pub social_links: Option<Vec<SocialLink>>,
    pub average_block_time: Option<f64>,
    pub current_block_reward: u64,
    pub current_block_height: u64,
}

impl Storable for TokenInfo {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(candid::encode_one(self).expect("Failed to encode TokenInfo"))
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        candid::decode_one(&bytes).expect("Failed to decode TokenInfo")
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 1024,
        is_fixed_size: false,
    };
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct SocialLink {
    pub platform: String,
    pub url: String,
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
    pub social_links: Option<Vec<SocialLink>>,
    pub initial_block_reward: u64,
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
    
#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct MiningInfo {
    pub current_difficulty: u32,
    pub current_block_reward: u64,
    pub block_time_target: u64,
    pub next_halving_interval: u64,
} 

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct TokenAllInfo {
    pub name: String,
    pub ticker: String,
    pub total_supply: u64,
    pub ledger_id: Option<Principal>,
    pub logo: Option<String>,
    pub decimals: u8,
    pub transfer_fee: u64,
    pub social_links: Option<Vec<SocialLink>>,
    
    pub average_block_time: Option<f64>,

    pub circulating_supply: u64,

    pub current_block_reward: u64,
    
    pub canister_id: Principal,
    pub current_block_height: u64,
}

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct TokenEverything {
    pub all_info: TokenAllInfo,
    
    pub active_miners_count: usize,
    pub mining_difficulty: u32,
    pub block_time_target: u64,
    
    pub mining_completion_estimate: Option<String>,
}

#[derive(CandidType, Serialize, Deserialize)]
pub enum AllInfoResult {
    Ok(TokenAllInfo),
    Err(String),
}

#[derive(CandidType, Serialize, Deserialize)]
pub enum EverythingResult {
    Ok(TokenEverything),
    Err(String),
} 

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MinerStats {
    pub blocks_mined: u64,
    pub total_rewards: u64,
    pub first_block_timestamp: Option<u64>,
    pub last_block_timestamp: Option<u64>,
    pub total_hashes_processed: u64,
    pub current_hashrate: f64,
    pub average_hashrate: f64,
    pub best_hashrate: f64,
    pub last_hashrate_update: Option<u64>,
    pub hashrate_samples: Vec<(u64, f64)>,
}

impl Default for MinerStats {
    fn default() -> Self {
        Self {
            blocks_mined: 0,
            total_rewards: 0,
            first_block_timestamp: None,
            last_block_timestamp: None,
            total_hashes_processed: 0,
            current_hashrate: 0.0,
            average_hashrate: 0.0,
            best_hashrate: 0.0,
            last_hashrate_update: None,
            hashrate_samples: Vec::new(),
        }
    }
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub enum MinerStatus {
    Active,
    Inactive,
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct MinerInfo {
    pub principal: Principal,
    pub status: MinerStatus,
    pub stats: MinerStats,
    pub registration_time: u64,
    pub last_status_change: u64,
}

impl Storable for MinerInfo {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(candid::encode_one(self).expect("Failed to encode MinerInfo"))
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        candid::decode_one(&bytes).expect("Failed to decode MinerInfo")
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 1024,
        is_fixed_size: false,
    };
}

#[derive(Clone, Debug, CandidType, Serialize, Deserialize)]
pub struct DelegationData {
    pub expiry: u64,
    pub delegation_id: Vec<u8>,
    pub created_at: u64,
    pub last_used: u64,
    pub use_count: u64,
}

impl Storable for DelegationData {
    fn to_bytes(&self) -> Cow<[u8]> {
        let mut bytes = Vec::with_capacity(40 + self.delegation_id.len());
        bytes.extend_from_slice(&self.expiry.to_be_bytes());
        bytes.extend_from_slice(&self.created_at.to_be_bytes());
        bytes.extend_from_slice(&self.last_used.to_be_bytes());
        bytes.extend_from_slice(&self.use_count.to_be_bytes());
        bytes.extend_from_slice(&(self.delegation_id.len() as u32).to_be_bytes());
        bytes.extend_from_slice(&self.delegation_id);
        Cow::Owned(bytes)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        let expiry = u64::from_be_bytes(bytes[0..8].try_into().expect("Invalid expiry bytes"));
        let created_at = u64::from_be_bytes(bytes[8..16].try_into().expect("Invalid created_at bytes"));
        let last_used = u64::from_be_bytes(bytes[16..24].try_into().expect("Invalid last_used bytes"));
        let use_count = u64::from_be_bytes(bytes[24..32].try_into().expect("Invalid use_count bytes"));
        let id_len = u32::from_be_bytes(bytes[32..36].try_into().expect("Invalid id_len bytes")) as usize;
        let delegation_id = bytes[36..36+id_len].to_vec();
        
        Self { 
            expiry, 
            delegation_id, 
            created_at, 
            last_used, 
            use_count 
        }
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 256,
        is_fixed_size: false,
    };
}

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct TokenMetrics {
    pub total_supply: u64,
    pub circulating_supply: u64,
}

#[derive(CandidType, Deserialize)]
pub enum MetricsResult {
    Ok(TokenMetrics),
    Err(String),
} 
