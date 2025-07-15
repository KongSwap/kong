use chrono::Local;
use kong_lib::stable_db_update::stable_db_update::{StableDBUpdate, StableMemory};
use kong_lib::stable_token::token::Token;
use std::collections::BTreeMap;
use futures::stream::{self, StreamExt};
use std::sync::Arc;
use tokio::sync::Mutex;

use crate::domain::claims::insert_claim_on_database;
use crate::domain::lp_tokens::insert_lp_token_on_database;
use crate::domain::pools::insert_pool_on_database;
use crate::domain::requests::{insert_request_on_database, insert_request_on_database_optimized};
use crate::domain::tokens::insert_token_on_database;
use crate::domain::transfers::insert_transfer_on_database;
use crate::domain::txs::insert_tx_on_database;
use crate::domain::users::insert_user_on_database;
use crate::database::state as db_state;
use crate::database::pool::DbPool;
use crate::database::prepared::{PreparedStatementsCache, PreparedStatements, get_or_create_prepared_statements};
use crate::database::cache::SmartCache;

use crate::canister::kong_data::KongData;

pub async fn get_db_updates(
    last_db_update_id: Option<u64>,
    kong_data: &KongData,
    db_pool: &DbPool,
    tokens_map: &mut BTreeMap<u32, u8>,
    pools_map: &mut BTreeMap<u32, (u32, u32)>,
) -> Result<u64, Box<dyn std::error::Error>> {
    get_db_updates_with_cache(last_db_update_id, kong_data, db_pool, tokens_map, pools_map, None).await
}

pub async fn get_db_updates_with_cache(
    last_db_update_id: Option<u64>,
    kong_data: &KongData,
    db_pool: &DbPool,
    tokens_map: &mut BTreeMap<u32, u8>,
    pools_map: &mut BTreeMap<u32, (u32, u32)>,
    prepared_cache: Option<&PreparedStatementsCache>,
) -> Result<u64, Box<dyn std::error::Error>> {
    get_db_updates_with_smart_cache(last_db_update_id, kong_data, db_pool, tokens_map, pools_map, prepared_cache).await
}

pub async fn get_db_updates_with_smart_cache(
    last_db_update_id: Option<u64>,
    kong_data: &KongData,
    db_pool: &DbPool,
    tokens_map: &mut BTreeMap<u32, u8>,
    pools_map: &mut BTreeMap<u32, (u32, u32)>,
    prepared_cache: Option<&PreparedStatementsCache>,
) -> Result<u64, Box<dyn std::error::Error>> {
    // Use the optimized parallel version
    get_db_updates_parallel(last_db_update_id, kong_data, db_pool, tokens_map, pools_map, prepared_cache).await
}

async fn process_single_update(
    db_update: &StableDBUpdate,
    db_pool: &DbPool,
    smart_cache: Arc<Mutex<SmartCache>>,
    _prepared_cache: Option<&PreparedStatementsCache>, // Not used in parallel mode
) -> Result<(), Box<dyn std::error::Error>> {
    // Get a connection for this specific update
    let db_client = db_pool.get().await?;
    
    // Don't use prepared statements in parallel mode to avoid connection issues
    let prepared_statements: Option<&PreparedStatements> = None;
    let stable_memory = &db_update.stable_memory;
    
    match stable_memory {
        StableMemory::KongSettings(_) => Ok(()),
        StableMemory::UserMap(user) => insert_user_on_database(user, &db_client).await,
        StableMemory::TokenMap(token) => {
            match insert_token_on_database(token, &db_client).await {
                Ok(()) => {
                    // Update cache after successful insert
                    let mut cache = smart_cache.lock().await;
                    cache.token_cache.add_token(token.token_id(), token.decimals());
                    Ok(())
                }
                Err(e) => Err(e),
            }
        },
        StableMemory::PoolMap(pool) => {
            let cache = smart_cache.lock().await;
            match insert_pool_on_database(pool, &db_client, &cache.token_cache.tokens_map).await {
                Ok(()) => {
                    drop(cache); // Release lock before updating
                    let mut cache = smart_cache.lock().await;
                    cache.pool_cache.add_pool(pool.pool_id, pool.token_id_0, pool.token_id_1);
                    Ok(())
                }
                Err(e) => Err(e),
            }
        },
        StableMemory::TxMap(tx) => {
            let cache = smart_cache.lock().await;
            insert_tx_on_database(tx, &db_client, &cache.token_cache.tokens_map, &cache.pool_cache.pools_map).await
        },
        StableMemory::RequestMap(request) => {
            if let Some(ref stmts) = prepared_statements {
                insert_request_on_database_optimized(request, &db_client, Some(stmts)).await
            } else {
                insert_request_on_database(request, &db_client).await
            }
        },
        StableMemory::TransferMap(transfer) => {
            let cache = smart_cache.lock().await;
            insert_transfer_on_database(transfer, &db_client, &cache.token_cache.tokens_map).await
        },
        StableMemory::ClaimMap(claim) => {
            let cache = smart_cache.lock().await;
            insert_claim_on_database(claim, &db_client, &cache.token_cache.tokens_map).await
        },
        StableMemory::LPTokenMap(lptoken) => {
            let cache = smart_cache.lock().await;
            insert_lp_token_on_database(lptoken, &db_client, &cache.token_cache.tokens_map).await
        },
    }
}

pub async fn get_db_updates_parallel(
    last_db_update_id: Option<u64>,
    kong_data: &KongData,
    db_pool: &DbPool,
    tokens_map: &mut BTreeMap<u32, u8>,
    pools_map: &mut BTreeMap<u32, (u32, u32)>,
    _prepared_cache: Option<&PreparedStatementsCache>, // Ignore prepared statements in parallel mode
) -> Result<u64, Box<dyn std::error::Error>> {
    // Convert legacy maps to smart cache (take ownership to avoid clone)
    let mut smart_cache_inner = SmartCache::new();
    std::mem::swap(&mut smart_cache_inner.token_cache.tokens_map, tokens_map);
    std::mem::swap(&mut smart_cache_inner.pool_cache.pools_map, pools_map);
    // Skip the last_full_reload update since we're using existing data
    let smart_cache = Arc::new(Mutex::new(smart_cache_inner));
    
    // Initialize smart cache if needed
    {
        let mut cache = smart_cache.lock().await;
        if cache.token_cache.is_empty() || cache.pool_cache.is_empty() {
            // Don't use prepared statements for initialization in parallel mode
            cache.initialize_if_needed(db_pool, None).await.unwrap_or_else(|e| {
                eprintln!("Warning: Failed to initialize smart cache: {}", e);
            });
        }
    }

    // Fetch updates from canister
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
    
    // Process updates in smaller batches
    const BATCH_SIZE: usize = 10000;
    const CONCURRENT_UPDATES: usize = 10; // Process 10 updates concurrently
    
    for chunk in db_updates.chunks(BATCH_SIZE) {
        // Track the last update ID in this batch
        if let Some(last) = chunk.last() {
            last_update_id = last.db_update_id;
        }
        
        // Process updates in parallel within the batch
        let results: Vec<_> = stream::iter(chunk.iter())
            .map(|db_update| {
                let smart_cache_clone = Arc::clone(&smart_cache);
                let db_pool_ref = db_pool;
                let update_id = db_update.db_update_id;
                
                async move {
                    let result = process_single_update(
                        db_update,
                        db_pool_ref,
                        smart_cache_clone,
                        None // Don't use prepared statements in parallel mode
                    ).await;
                    (update_id, result)
                }
            })
            .buffer_unordered(CONCURRENT_UPDATES)
            .collect()
            .await;
        
        // Check for errors
        let mut batch_had_errors = false;
        for (update_id, result) in results {
            if let Err(e) = result {
                eprintln!("Error processing db_update_id {}: {}", update_id, e);
                batch_had_errors = true;
            }
        }
        
        // Update checkpoint after successful batch
        if !batch_had_errors && chunk.len() > 0 {
            let batch_last_id = chunk.last().unwrap().db_update_id;
            if let Err(e) = db_state::update_last_db_update_id(db_pool, batch_last_id).await {
                eprintln!("Warning: Failed to update checkpoint after batch: {}", e);
            }
        }
    }

    println!(
        "--- processed db_update_id={} - {} records updated ---",
        last_update_id,
        db_updates.len()
    );

    // Convert smart cache back to legacy maps
    let cache = smart_cache.lock().await;
    let (updated_tokens_map, updated_pools_map) = cache.to_legacy_maps();
    *tokens_map = updated_tokens_map;
    *pools_map = updated_pools_map;

    println!(
        "Smart cache stats: {} tokens cached, {} pools cached",
        cache.token_cache.len(),
        cache.pool_cache.len()
    );

    Ok(last_update_id)
}

// Original sequential version kept for reference
#[allow(dead_code)]
async fn get_db_updates_sequential(
    last_db_update_id: Option<u64>,
    kong_data: &KongData,
    db_pool: &DbPool,
    tokens_map: &mut BTreeMap<u32, u8>,
    pools_map: &mut BTreeMap<u32, (u32, u32)>,
    prepared_cache: Option<&PreparedStatementsCache>,
) -> Result<u64, Box<dyn std::error::Error>> {
    // Convert legacy maps to smart cache
    let mut smart_cache = SmartCache::from_legacy_maps(tokens_map.clone(), pools_map.clone());
    
    // Initialize smart cache if needed (first run or periodic refresh)
    if smart_cache.token_cache.is_empty() || smart_cache.pool_cache.is_empty() {
        if let Some(cache) = prepared_cache {
            let client = db_pool.get().await?;
            let prepared_statements = get_or_create_prepared_statements(cache, &client).await?;
            smart_cache.initialize_if_needed(db_pool, Some(&prepared_statements)).await.unwrap_or_else(|e| {
                eprintln!("Warning: Failed to initialize smart cache: {}", e);
            });
        } else {
            smart_cache.initialize_if_needed(db_pool, None).await.unwrap_or_else(|e| {
                eprintln!("Warning: Failed to initialize smart cache: {}", e);
            });
        }
    }

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
    let mut errors_occurred = false;
    
    // Process updates in smaller batches for better atomicity
    const BATCH_SIZE: usize = 10000;
    for chunk in db_updates.chunks(BATCH_SIZE) {
        // Get a database connection from the pool for this batch
        let db_client = db_pool.get().await?;
        
        // Get or create prepared statements for this connection
        let prepared_statements = if let Some(cache) = prepared_cache {
            Some(get_or_create_prepared_statements(cache, &db_client).await?)
        } else {
            None
        };
        
        // Process each chunk
        for db_update in chunk.iter() {
            last_update_id = db_update.db_update_id;
            let stable_memory = &db_update.stable_memory;
            
            let result = match stable_memory {
                StableMemory::KongSettings(_) => Ok(()),
                StableMemory::UserMap(user) => insert_user_on_database(user, &db_client).await,
                StableMemory::TokenMap(token) => {
                    match insert_token_on_database(token, &db_client).await {
                        Ok(()) => {
                            // Smart cache: only ensure this specific token is cached
                            smart_cache.token_cache.ensure_token_cached(
                                token.token_id(), 
                                db_pool, 
                                prepared_statements.as_ref()
                            ).await.unwrap_or_else(|e| {
                                eprintln!("Warning: Failed to cache token {}: {}", token.token_id(), e);
                            });
                            Ok(())
                        }
                        Err(e) => Err(e),
                    }
                },
                StableMemory::PoolMap(pool) => {
                    match insert_pool_on_database(pool, &db_client, &smart_cache.token_cache.tokens_map).await {
                        Ok(()) => {
                            // Smart cache: only ensure this specific pool is cached
                            smart_cache.pool_cache.ensure_pool_cached(
                                pool.pool_id, 
                                db_pool, 
                                prepared_statements.as_ref()
                            ).await.unwrap_or_else(|e| {
                                eprintln!("Warning: Failed to cache pool {}: {}", pool.pool_id, e);
                            });
                            Ok(())
                        }
                        Err(e) => Err(e),
                    }
                },
                StableMemory::TxMap(tx) => insert_tx_on_database(tx, &db_client, &smart_cache.token_cache.tokens_map, &smart_cache.pool_cache.pools_map).await,
                StableMemory::RequestMap(request) => {
                    if let Some(ref stmts) = prepared_statements {
                        insert_request_on_database_optimized(request, &db_client, Some(stmts)).await
                    } else {
                        insert_request_on_database(request, &db_client).await
                    }
                },
                StableMemory::TransferMap(transfer) => insert_transfer_on_database(transfer, &db_client, &smart_cache.token_cache.tokens_map).await,
                StableMemory::ClaimMap(claim) => insert_claim_on_database(claim, &db_client, &smart_cache.token_cache.tokens_map).await,
                StableMemory::LPTokenMap(lptoken) => insert_lp_token_on_database(lptoken, &db_client, &smart_cache.token_cache.tokens_map).await,
            };
            
            if let Err(e) = result {
                eprintln!("Error processing db_update_id {}: {}", db_update.db_update_id, e);
                errors_occurred = true;
                // Continue processing other updates in the batch
            }
        }
        
        // After each batch, update the checkpoint if no critical errors occurred
        if !errors_occurred && chunk.len() > 0 {
            let batch_last_id = chunk.last().unwrap().db_update_id;
            if let Err(e) = db_state::update_last_db_update_id(db_pool, batch_last_id).await {
                eprintln!("Warning: Failed to update checkpoint after batch: {}", e);
            }
        }
    }

    println!(
        "--- processed db_update_id={} - {} records updated ---",
        last_update_id,
        db_updates.len()
    );

    // Convert smart cache back to legacy maps for caller
    let (updated_tokens_map, updated_pools_map) = smart_cache.to_legacy_maps();
    *tokens_map = updated_tokens_map;
    *pools_map = updated_pools_map;

    println!(
        "Smart cache stats: {} tokens cached, {} pools cached",
        smart_cache.token_cache.len(),
        smart_cache.pool_cache.len()
    );

    Ok(last_update_id)
}
