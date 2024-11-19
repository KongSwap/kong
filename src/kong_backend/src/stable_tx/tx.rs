use super::stable_tx::StableTx;
use super::stable_tx_alt::StableTxAlt;

pub trait Tx {
    fn user_id(&self) -> u32;
    fn ts(&self) -> u64;
}

impl Tx for StableTx {
    fn user_id(&self) -> u32 {
        match self {
            StableTx::AddPool(tx) => tx.user_id,
            StableTx::AddLiquidity(tx) => tx.user_id,
            StableTx::RemoveLiquidity(tx) => tx.user_id,
            StableTx::Swap(tx) => tx.user_id,
            StableTx::Send(tx) => tx.user_id,
        }
    }

    fn ts(&self) -> u64 {
        match self {
            StableTx::AddPool(tx) => tx.ts,
            StableTx::AddLiquidity(tx) => tx.ts,
            StableTx::RemoveLiquidity(tx) => tx.ts,
            StableTx::Swap(tx) => tx.ts,
            StableTx::Send(tx) => tx.ts,
        }
    }
}

impl Tx for StableTxAlt {
    fn user_id(&self) -> u32 {
        match self {
            StableTxAlt::AddPool(tx) => tx.user_id,
            StableTxAlt::AddLiquidity(tx) => tx.user_id,
            StableTxAlt::RemoveLiquidity(tx) => tx.user_id,
            StableTxAlt::Swap(tx) => tx.user_id,
            StableTxAlt::Send(tx) => tx.user_id,
        }
    }

    fn ts(&self) -> u64 {
        match self {
            StableTxAlt::AddPool(tx) => tx.ts,
            StableTxAlt::AddLiquidity(tx) => tx.ts,
            StableTxAlt::RemoveLiquidity(tx) => tx.ts,
            StableTxAlt::Swap(tx) => tx.ts,
            StableTxAlt::Send(tx) => tx.ts,
        }
    }
}
