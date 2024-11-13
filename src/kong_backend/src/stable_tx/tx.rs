use super::stable_tx::StableTx;

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
