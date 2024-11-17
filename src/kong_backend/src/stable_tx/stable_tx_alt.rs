use candid::CandidType;
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};

use super::add_liquidity_tx::AddLiquidityTx;
use super::add_pool_tx::AddPoolTx;
use super::remove_liquidity_tx::RemoveLiquidityTx;
use super::send_tx::SendTx;
use super::stable_tx::{StableTx, StableTxId};
use super::swap_tx::SwapTx;

#[derive(CandidType, Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct StableTxIdAlt(pub u64);

impl StableTxIdAlt {
    pub fn from_stable_tx_id(stable_tx_id: &StableTxId) -> Self {
        let tx_id_alt = serde_json::to_value(stable_tx_id).unwrap();
        serde_json::from_value(tx_id_alt).unwrap()
    }
}

impl Storable for StableTxIdAlt {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub enum StableTxAlt {
    AddPool(AddPoolTx),
    AddLiquidity(AddLiquidityTx),
    RemoveLiquidity(RemoveLiquidityTx),
    Swap(SwapTx),
    Send(SendTx),
}

impl StableTxAlt {
    pub fn from_stable_tx(stable_tx: &StableTx) -> Self {
        let tx_alt = serde_json::to_value(stable_tx).unwrap();
        serde_json::from_value(tx_alt).unwrap()
    }
}

impl Storable for StableTxAlt {
    fn to_bytes(&self) -> std::borrow::Cow<[u8]> {
        serde_cbor::to_vec(self).unwrap().into()
    }

    fn from_bytes(bytes: std::borrow::Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Unbounded;
}
