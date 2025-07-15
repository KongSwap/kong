use std::collections::BTreeMap;
use crate::database::pool::DbPool;

// Adapter functions to bridge between pool-based and client-based APIs

pub async fn update_users_on_database_adapter(db_pool: &DbPool) -> Result<(), Box<dyn std::error::Error>> {
    // Use the new pool-based function with transactions for better performance
    crate::domain::users::update_users_on_database_with_pool_batched(db_pool).await
}

pub async fn update_pools_on_database_adapter(
    db_pool: &DbPool, 
    tokens_map: &BTreeMap<u32, u8>
) -> Result<BTreeMap<u32, (u32, u32)>, Box<dyn std::error::Error>> {
    crate::domain::pools::update_pools_on_database(db_pool, tokens_map).await
}

pub async fn update_lp_tokens_on_database_adapter(
    db_pool: &DbPool, 
    tokens_map: &BTreeMap<u32, u8>
) -> Result<(), Box<dyn std::error::Error>> {
    // Use the new pool-based function with transactions for better performance
    crate::domain::lp_tokens::update_lp_tokens_on_database_with_pool_batched(db_pool, tokens_map).await
}

pub async fn update_claims_on_database_adapter(
    db_pool: &DbPool, 
    tokens_map: &BTreeMap<u32, u8>
) -> Result<(), Box<dyn std::error::Error>> {
    let db_client = db_pool.get().await?;
    crate::domain::claims::update_claims_on_database(&db_client, tokens_map).await
}

pub async fn update_transfers_on_database_adapter(
    db_pool: &DbPool, 
    tokens_map: &BTreeMap<u32, u8>
) -> Result<(), Box<dyn std::error::Error>> {
    // Use the new pool-based function with transactions for better performance
    crate::domain::transfers::update_transfers_on_database_with_pool_batched(db_pool, tokens_map).await
}

pub async fn update_txs_on_database_adapter(
    db_pool: &DbPool, 
    tokens_map: &BTreeMap<u32, u8>,
    pools_map: &BTreeMap<u32, (u32, u32)>
) -> Result<(), Box<dyn std::error::Error>> {
    crate::domain::txs::update_txs_on_database(db_pool, tokens_map, pools_map).await
}

pub async fn load_pools_from_database_adapter(db_pool: &DbPool) -> Result<BTreeMap<u32, (u32, u32)>, Box<dyn std::error::Error>> {
    let db_client = db_pool.get().await?;
    crate::domain::pools::load_pools_from_database(&db_client).await
}