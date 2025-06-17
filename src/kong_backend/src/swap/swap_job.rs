use candid::{CandidType, Deserialize, Principal};
use serde::Serialize; // Added Serialize
use ic_stable_structures::{storable::Bound, Storable};
use std::borrow::Cow;

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq, Copy)]
pub enum SwapJobStatus {
    PendingVerification, // Payment verification in progress
    Pending,    // Job created, awaiting processing by ws_proxy
    Confirmed,  // Confirmed by ws_proxy as successful on Solana
    Failed,     // Failed (either Solana tx failed, or an internal error)
}

impl Storable for SwapJobStatus {
    fn to_bytes(&self) -> Cow<[u8]> {
        match self {
            SwapJobStatus::PendingVerification => Cow::Borrowed(&[0]),
            SwapJobStatus::Pending => Cow::Borrowed(&[1]),
            SwapJobStatus::Confirmed => Cow::Borrowed(&[2]),
            SwapJobStatus::Failed => Cow::Borrowed(&[3]),
        }
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        match bytes.first() {
            Some(&0) => SwapJobStatus::PendingVerification,
            Some(&1) => SwapJobStatus::Pending,
            Some(&2) => SwapJobStatus::Confirmed,
            Some(&3) => SwapJobStatus::Failed,
            _ => panic!("Invalid SwapJobStatus bytes"), // Or handle error appropriately
        }
    }
    const BOUND: Bound = Bound::Bounded { max_size: 1, is_fixed_size: true };
}


/// Parameters for creating a new SwapJob
#[derive(Clone, Debug)]
pub struct SwapJobParams {
    pub id: u64,
    pub caller: Principal,
    pub original_args_json: String,
    pub status: SwapJobStatus,
    pub created_at: u64,
    pub updated_at: u64,
    pub encoded_signed_solana_tx: String,
    pub solana_tx_signature_of_payout: Option<String>,
    pub error_message: Option<String>,
    pub attempts: u32,
    pub tx_sig: String,
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct SwapJob {
    pub id: u64,
    pub caller: Principal,
    pub original_args_json: String,
    pub status: SwapJobStatus,
    pub created_at: u64, // ic_cdk::api::time()
    pub updated_at: u64,
    pub encoded_signed_solana_tx: String, 
    pub solana_tx_signature_of_payout: Option<String>,
    pub error_message: Option<String>,
    pub attempts: u32, // For ws_proxy retry logic
    pub tx_sig: String, // Transaction signature computed at signing time
}

impl Storable for SwapJob {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_json::to_vec(self).expect("Failed to serialize SwapJob"))
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_json::from_slice(bytes.as_ref()).expect("Failed to deserialize SwapJob")
    }
    const BOUND: Bound = Bound::Unbounded; 
}

impl SwapJob {
    pub fn new(params: SwapJobParams) -> Self {
        Self {
            id: params.id,
            caller: params.caller,
            original_args_json: params.original_args_json,
            status: params.status,
            created_at: params.created_at,
            updated_at: params.updated_at,
            encoded_signed_solana_tx: params.encoded_signed_solana_tx,
            solana_tx_signature_of_payout: params.solana_tx_signature_of_payout,
            error_message: params.error_message,
            attempts: params.attempts,
            tx_sig: params.tx_sig,
        }
    }
}

#[derive(CandidType, Deserialize, Serialize, Debug, Clone)]
pub struct QueuedSwapReply {
    pub job_id: u64,
    pub status: String, // e.g., "Queued", "Pending", "Completed", "Failed"
    pub message: String,
}
