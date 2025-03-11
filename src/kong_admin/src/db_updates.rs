use chrono::Local;
use kong_lib::stable_db_update::stable_db_update::{StableDBUpdate, StableMemory};
use kong_lib::stable_token::token::Token;
use std::collections::BTreeMap;
use tokio_postgres::Client;

use crate::claims::insert_claim_on_database;
use crate::lp_tokens::insert_lp_token_on_database;
use crate::pools::{insert_pool_on_database, load_pools_from_database};
use crate::requests::insert_request_on_database;
use crate::tokens::{insert_token_on_database, load_tokens_from_database};
use crate::transfers::insert_transfer_on_database;
use crate::txs::insert_tx_on_database;
use crate::users::insert_user_on_database;

use super::kong_data::KongData;

pub async fn get_db_updates(
    last_db_update_id: Option<u64>,
    kong_data: &KongData,
    db_client: &Client,
    tokens_map: &mut BTreeMap<u32, u8>,
    pools_map: &mut BTreeMap<u32, (u32, u32)>,
) -> Result<u64, Box<dyn std::error::Error>> {
    // start from last_db_update_id + 1 as last_db_update is already processed
    let db_update_id = last_db_update_id.map(|id| id + 1);
    let json = kong_data.backup_db_updates(db_update_id).await?;
    let db_updates: Vec<StableDBUpdate> = serde_json::from_str(&json)?;
    if db_updates.is_empty() {
        return Ok(last_db_update_id.unwrap_or(0));
    }

    let current_time = Local::now();
    let formatted_time = current_time.format("%Y-%m-%d %H:%M:%S").to_string();
    println!("\n--- processing db_update_id={:?} @ {} ---", db_update_id, formatted_time);

    let mut last_update_id = last_db_update_id.unwrap_or(0);
    for db_update in db_updates.iter() {
        last_update_id = db_update.db_update_id;
        let stable_memory = &db_update.stable_memory;
        match stable_memory {
            StableMemory::KongSettings(_) => (),
            StableMemory::UserMap(user) => insert_user_on_database(user, db_client)
                .await
                .unwrap_or_else(|e| eprintln!("{}", e)),
            StableMemory::TokenMap(token) => match insert_token_on_database(token, db_client).await {
                Ok(()) => {
                    if !tokens_map.contains_key(&token.token_id()) {
                        *tokens_map = load_tokens_from_database(db_client).await?;
                    }
                }
                Err(e) => eprintln!("{}", e),
            },
            StableMemory::PoolMap(pool) => match insert_pool_on_database(pool, db_client, tokens_map).await {
                Ok(()) => {
                    if !pools_map.contains_key(&pool.pool_id) {
                        *pools_map = load_pools_from_database(db_client).await?;
                    }
                }
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

    println!(
        "--- processed db_update_id={} - {} records updated ---",
        last_update_id,
        db_updates.len()
    );

    Ok(last_update_id)
}
