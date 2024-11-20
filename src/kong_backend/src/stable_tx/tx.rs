use super::stable_tx::StableTx;
use super::stable_tx_old::StableTxOld;

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

impl Tx for StableTxOld {
    fn user_id(&self) -> u32 {
        match self {
            StableTxOld::AddPool(tx) => tx.user_id,
            StableTxOld::AddLiquidity(tx) => tx.user_id,
            StableTxOld::RemoveLiquidity(tx) => tx.user_id,
            StableTxOld::Swap(tx) => tx.user_id,
            StableTxOld::Send(tx) => tx.user_id,
        }
    }

    fn ts(&self) -> u64 {
        match self {
            StableTxOld::AddPool(tx) => tx.ts,
            StableTxOld::AddLiquidity(tx) => tx.ts,
            StableTxOld::RemoveLiquidity(tx) => tx.ts,
            StableTxOld::Swap(tx) => tx.ts,
            StableTxOld::Send(tx) => tx.ts,
        }
    }
}
