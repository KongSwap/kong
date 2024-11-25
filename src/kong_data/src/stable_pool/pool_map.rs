use crate::stable_memory::POOL_MAP;
use crate::stable_pool::stable_pool::{StablePool, StablePoolId};

pub fn get_by_pool_id(pool_id: u32) -> Option<StablePool> {
    POOL_MAP.with(|m| m.borrow().get(&StablePoolId(pool_id)))
}
