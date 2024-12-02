use super::stable_tx::StableTx;

pub trait Tx {
    fn tx_id(&self) -> u64;
    fn user_id(&self) -> u32;
}

impl Tx for StableTx {
    fn tx_id(&self) -> u64 {
        match self {
            StableTx::AddPool(tx) => tx.tx_id,
            StableTx::AddLiquidity(tx) => tx.tx_id,
            StableTx::RemoveLiquidity(tx) => tx.tx_id,
            StableTx::Swap(tx) => tx.tx_id,
            StableTx::Send(tx) => tx.tx_id,
        }
    }

    fn user_id(&self) -> u32 {
        match self {
            StableTx::AddPool(tx) => tx.user_id,
            StableTx::AddLiquidity(tx) => tx.user_id,
            StableTx::RemoveLiquidity(tx) => tx.user_id,
            StableTx::Swap(tx) => tx.user_id,
            StableTx::Send(tx) => tx.user_id,
        }
    }
}
