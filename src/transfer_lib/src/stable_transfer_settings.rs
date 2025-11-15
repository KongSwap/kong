use crate::stable_memory::TRANSFER_MAP;
use candid::CandidType;
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct StableTransferSettings {
    pub transfer_map_idx: u64, // counter for TRANSFER_MAP
}

impl Default for StableTransferSettings {
    fn default() -> Self {
        let transfer_map_idx = TRANSFER_MAP.with(|m| m.borrow().iter().map(|(k, _)| k.0).max().unwrap_or(0));
        Self { transfer_map_idx }
    }
}

impl Storable for StableTransferSettings {
    fn to_bytes(&self) -> std::borrow::Cow<'_, [u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap_or_default()
    }

    const BOUND: Bound = Bound::Unbounded;
}
