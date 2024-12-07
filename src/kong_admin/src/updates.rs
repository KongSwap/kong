use chrono::Local;
use kong_lib::stable_update::stable_update::{StableMemory, StableUpdate};
use std::collections::BTreeMap;
use tokio_postgres::Client;

use crate::claims::insert_claim_on_database;
use crate::lp_tokens::insert_lp_token_on_database;
use crate::pools::insert_pool_on_database;
use crate::requests::insert_request_on_database;
use crate::tokens::insert_token_on_database;
use crate::transfers::insert_transfer_on_database;
use crate::txs::insert_tx_on_database;
use crate::users::insert_user_on_database;

use super::kong_data::KongData;

pub async fn get_db_updates(
    update_id: Option<u64>,
    kong_data: &KongData,
    db_client: &Client,
    tokens_map: &BTreeMap<u32, u8>,
    pools_map: &BTreeMap<u32, (u32, u32)>,
) -> Result<u64, Box<dyn std::error::Error>> {
    let current_time = Local::now();
    let formatted_time = current_time.format("%Y-%m-%d %H:%M:%S").to_string();
    println!("\nDB updates @ {}", formatted_time);

    let json = kong_data.backup_db_updates(update_id).await?;
    let db_updates: Vec<StableUpdate> = serde_json::from_str(&json)?;

    let mut last_update_id = 0;
    for db_update in db_updates.iter() {
        last_update_id = db_update.update_id;
        let stable_memory = &db_update.stable_memory;
        match stable_memory {
            StableMemory::KongSettings(_) => (),
            StableMemory::UserMap(user) => insert_user_on_database(user, db_client).await?,
            StableMemory::TokenMap(token) => insert_token_on_database(token, db_client).await?,
            StableMemory::PoolMap(pool) => insert_pool_on_database(pool, db_client, tokens_map).await?,
            StableMemory::TxMap(tx) => insert_tx_on_database(tx, db_client, tokens_map, pools_map).await?,
            StableMemory::RequestMap(request) => insert_request_on_database(request, db_client).await?,
            StableMemory::TransferMap(transfer) => insert_transfer_on_database(transfer, db_client, tokens_map).await?,
            StableMemory::ClaimMap(claim) => insert_claim_on_database(claim, db_client, tokens_map).await?,
            StableMemory::LPTokenMap(lptoken) => insert_lp_token_on_database(lptoken, db_client, tokens_map).await?,
            StableMemory::MessageMap(message) => (),
        }
    }

    println!("DB updates {} updated", db_updates.len());

    if last_update_id > 0 {
        _ = kong_data.remove_db_updates(last_update_id).await?;
    }

    Ok(last_update_id)
}
