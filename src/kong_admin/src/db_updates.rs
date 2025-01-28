use chrono::Local;
use kong_lib::stable_db_update::stable_db_update::{StableDBUpdate, StableMemory};
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
    kong_data: &KongData,
    db_client: &Client,
    tokens_map: &mut BTreeMap<u32, u8>,
    pools_map: &mut BTreeMap<u32, (u32, u32)>,
) -> Result<u64, Box<dyn std::error::Error>> {
    let current_time = Local::now();
    let formatted_time = current_time.format("%Y-%m-%d %H:%M:%S").to_string();
    println!("\n--- DB updates @ {} ---", formatted_time);

    let json = kong_data.backup_db_updates().await?;
    let db_updates: Vec<StableDBUpdate> = serde_json::from_str(&json)?;

    let mut last_update_id = 0;
    for db_update in db_updates.iter() {
        last_update_id = db_update.db_update_id;
        let stable_memory = &db_update.stable_memory;
        match stable_memory {
            StableMemory::KongSettings(_) => (),
            StableMemory::UserMap(user) => insert_user_on_database(user, db_client)
                .await
                .unwrap_or_else(|e| eprintln!("{}", e)),
            StableMemory::TokenMap(token) => match insert_token_on_database(token, db_client).await {
                Ok(map) => *tokens_map = map,
                Err(e) => eprintln!("{}", e),
            },
            StableMemory::PoolMap(pool) => match insert_pool_on_database(pool, db_client, tokens_map).await {
                Ok(map) => *pools_map = map,
                Err(e) => eprintln!("{}", e),
            },
            StableMemory::TxMap(tx) => insert_tx_on_database(tx, db_client, tokens_map, pools_map)
                .await
                .unwrap_or_else(|e| eprintln!("{}", e)),
            StableMemory::RequestMap(request) => insert_request_on_database(request, db_client)
                .await
                .unwrap_or_else(|e| eprintln!("{}", e)),
            StableMemory::TransferMap(transfer) => insert_transfer_on_database(transfer, db_client, tokens_map)
                .await
                .unwrap_or_else(|e| eprintln!("{}", e)),
            StableMemory::ClaimMap(claim) => insert_claim_on_database(claim, db_client, tokens_map)
                .await
                .unwrap_or_else(|e| eprintln!("{}", e)),
            StableMemory::LPTokenMap(lptoken) => insert_lp_token_on_database(lptoken, db_client, tokens_map)
                .await
                .unwrap_or_else(|e| eprintln!("{}", e)),
        }
    }

    println!("--- DB updates {} records updated ---", db_updates.len());

    if last_update_id > 0 {
        _ = kong_data.remove_db_updates(last_update_id).await?;
    }

    Ok(last_update_id)
}
