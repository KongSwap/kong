use candid::{CandidType, Deserialize, Nat};
use ic_stable_structures::{storable::Bound, Storable};
use serde::Serialize;
use std::borrow::Cow;

#[derive(CandidType, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct SwapJobId(pub u64);

impl Storable for SwapJobId {
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        serde_cbor::to_vec(self).expect("Failed to encode SwapJobId").into()
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).expect("Failed to decode SwapJobId")
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 16,
        is_fixed_size: false,
    };
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug, PartialEq, Eq, Copy)]
pub enum SwapJobStatus {
    Pending,   // Job created, awaiting processing by kong_rpc
    Confirmed, // Confirmed by kong_rpc as successful on Solana
    Failed,    // Failed (either Solana tx failed, or an internal error)
    Expired,   // Timed out after 300s without response from kong_rpc (status unknown)
}

impl Storable for SwapJobStatus {
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        match self {
            SwapJobStatus::Pending => Cow::Borrowed(&[0]),
            SwapJobStatus::Confirmed => Cow::Borrowed(&[1]),
            SwapJobStatus::Failed => Cow::Borrowed(&[2]),
            SwapJobStatus::Expired => Cow::Borrowed(&[3]),
        }
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        match bytes.first() {
            Some(&0) => SwapJobStatus::Pending,
            Some(&1) => SwapJobStatus::Confirmed,
            Some(&2) => SwapJobStatus::Failed,
            Some(&3) => SwapJobStatus::Expired,
            _ => panic!("Invalid SwapJobStatus bytes"),
        }
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 1,
        is_fixed_size: true,
    };
}

#[derive(CandidType, Deserialize, Serialize, Clone, Debug)]
pub struct SwapJob {
    pub id: u64, // * Used by kong rpc
    pub user_id: u32,
    pub request_id: u64,
    pub amount: Nat,
    pub symbol: String,
    pub status: SwapJobStatus,
    pub dst_address: String,
    pub created_at: u64, // ic_cdk::api::time()
    pub updated_at: u64,
    pub encoded_signed_solana_tx: String, // * Used by kong rpc
    pub solana_tx_signature_of_payout: Option<String>, // Final tx signature confirmed by Solana network (after successful submission)
    pub error_message: Option<String>,
    pub tx_sig: String, // * Used by kong rpc. Initial tx signature computed locally at signing time (before network submission)
}

impl Storable for SwapJob {
    fn to_bytes(&self) -> Cow<'_, [u8]> {
        serde_cbor::to_vec(self).expect("Failed to encode SwapJob").into()
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).expect("Failed to decode SwapJob")
    }
    const BOUND: Bound = Bound::Unbounded;
}
