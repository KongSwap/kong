use kong_lib::stable_transfer::stable_transfer::{StableTransfer, StableTransferId};
use kong_lib::stable_transfer::tx_id::TxId;
use num_traits::ToPrimitive;
use regex::Regex;
use serde_json::json;
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;
use tokio_postgres::{Client, Statement, Transaction};
use deadpool_postgres::Pool;

use crate::database::pool::DbPool;
use crate::canister::kong_update::KongUpdate;
use crate::utils::math::round_f64;
use crate::database::prepared::PreparedStatements;

pub struct TransferTokenCache {
    decimals: HashMap<u32, u8>,
}

impl TransferTokenCache {
    pub fn new(tokens_map: &BTreeMap<u32, u8>) -> Self {
        Self {
            decimals: tokens_map.iter().map(|(&k, &v)| (k, v)).collect(),
        }
    }

    #[inline]
    fn get_decimals(&self, token_id: u32) -> Result<u8, Box<dyn std::error::Error>> {
        self.decimals
            .get(&token_id)
            .copied()
            .ok_or_else(|| format!("token_id={} not found", token_id).into())
    }
}

pub struct TransferPreparedStatements {
    insert_transfer: Statement,
}

impl TransferPreparedStatements {
    pub async fn new(client: &Client) -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Self {
            insert_transfer: client
                .prepare(
                    "INSERT INTO transfers
                        (transfer_id, request_id, is_send, token_id, amount, block_index, tx_hash, ts, raw_json)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8), $9)
                        ON CONFLICT (transfer_id) DO UPDATE SET
                            request_id = $2,
                            is_send = $3,
                            token_id = $4,
                            amount = $5,
                            block_index = $6,
                            tx_hash = $7,
                            ts = to_timestamp($8),
                            raw_json = $9",
                )
                .await?,
        })
    }
}

pub fn serialize_option_tx_id(tx_id: Option<&TxId>) -> serde_json::Value {
    match tx_id {
        Some(tx_id) => match tx_id {
            TxId::BlockIndex(block_index) => json!(block_index.to_string()),
            TxId::TransactionHash(tx_hash) => json!(tx_hash),
        },
        None => json!("None"),
    }
}

pub fn serialize_tx_id(tx_id: &TxId) -> serde_json::Value {
    match tx_id {
        TxId::BlockIndex(block_index) => json!(block_index.to_string()),
        TxId::TransactionHash(tx_hash) => json!(tx_hash),
    }
}

pub fn serialize_transfer(transfer: &StableTransfer) -> serde_json::Value {
    json!({
        "StableTransfer": {
            "transfer_id": transfer.transfer_id,
            "request_id": transfer.request_id,
            "is_send": transfer.is_send,
            "amount": transfer.amount.to_string(),
            "token_id": transfer.token_id,
            "tx_id": serialize_tx_id(&transfer.tx_id),
            "ts": transfer.ts,
        }
    })
}

/// Update transfers using database pool with batch processing and transactions
pub async fn update_transfers_on_database_with_pool_batched(
    db_pool: &DbPool,
    tokens_map: &BTreeMap<u32, u8>,
) -> Result<(), Box<dyn std::error::Error>> {
    let dir_path = "./backups";
    let re_pattern = Regex::new(r"^transfers.*.json$").unwrap();
    let mut files = fs::read_dir(dir_path)?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            if re_pattern.is_match(entry.file_name().to_str().unwrap()) {
                Some(entry)
            } else {
                None
            }
        })
        .map(|entry| {
            let file = entry.path();
            let filename = Path::new(&file).file_name().unwrap().to_str().unwrap();
            let number_str = filename.split('.').nth(1).unwrap();
            let number = number_str.parse::<u32>().unwrap();
            (number, file)
        })
        .collect::<Vec<_>>();
    files.sort_by(|a, b| a.0.cmp(&b.0));

    // Process all files with batch transactions
    const BATCH_SIZE: usize = 1000;
    let mut batch: Vec<StableTransfer> = Vec::with_capacity(BATCH_SIZE);
    let mut total_processed = 0;
    let start_time = std::time::Instant::now();

    for (file_num, file_path) in files {
        println!("Processing transfers file {}: {:?}", file_num, file_path.file_name().unwrap());
        
        let file = File::open(file_path)?;
        let reader = BufReader::new(file);
        let transfer_map: BTreeMap<StableTransferId, StableTransfer> = serde_json::from_reader(reader)?;

        for v in transfer_map.values() {
            batch.push(v.clone());
            
            if batch.len() >= BATCH_SIZE {
                process_transfer_batch_transactional(db_pool, &batch, tokens_map).await?;
                total_processed += batch.len();
                batch.clear();
                
                // Progress update
                if total_processed % 10000 == 0 {
                    let elapsed = start_time.elapsed();
                    let rate = total_processed as f64 / elapsed.as_secs_f64();
                    println!("Progress: {} transfers processed ({:.0} transfers/sec)", total_processed, rate);
                }
            }
        }
    }
    
    // Process remaining transfers
    if !batch.is_empty() {
        process_transfer_batch_transactional(db_pool, &batch, tokens_map).await?;
        total_processed += batch.len();
    }
    
    let total_elapsed = start_time.elapsed();
    println!("All transfers processed. Total: {} transfers in {:.2}s ({:.0} transfers/sec)",
             total_processed, total_elapsed.as_secs_f64(), 
             total_processed as f64 / total_elapsed.as_secs_f64());

    Ok(())
}

/// Process a batch of transfers with a transaction for better performance
async fn process_transfer_batch_transactional(
    db_pool: &DbPool,
    transfers: &[StableTransfer],
    tokens_map: &BTreeMap<u32, u8>,
) -> Result<(), Box<dyn std::error::Error>> {
    if transfers.is_empty() {
        return Ok(());
    }

    // Get a connection from the pool
    let mut db_client = db_pool.get().await?;
    
    // Create prepared statements for this connection
    let prepared_statements = PreparedStatements::new(&db_client).await?;
    
    // Start a transaction
    let transaction = db_client.transaction().await?;
    
    // Process all transfers in the batch
    for transfer in transfers {
        if let Err(e) = insert_transfer_on_database_transactional(transfer, &transaction, Some(&prepared_statements), tokens_map).await {
            // Rollback on error
            if let Err(rollback_err) = transaction.rollback().await {
                return Err(format!("Failed to insert transfer {} ({}), and rollback failed: {}", 
                                  transfer.transfer_id, e, rollback_err).into());
            }
            return Err(format!("Failed to insert transfer {}: {}", transfer.transfer_id, e).into());
        }
    }
    
    // Commit the transaction
    transaction.commit().await?;
    
    println!("✅ Processed batch of {} transfers", transfers.len());
    Ok(())
}

/// Insert transfer using a transaction for better performance and atomicity
pub async fn insert_transfer_on_database_transactional(
    v: &StableTransfer,
    transaction: &Transaction<'_>,
    prepared_statements: Option<&PreparedStatements>,
    tokens_map: &BTreeMap<u32, u8>,
) -> Result<(), Box<dyn std::error::Error>> {
    let transfer_id = v.transfer_id as i64;
    let request_id = v.request_id as i64;
    let is_send = v.is_send;
    let token_id = v.token_id as i32;
    let decimals = tokens_map.get(&v.token_id).ok_or(format!("token_id={} not found", v.token_id))?;
    let amount = round_f64(v.amount.0.to_f64().unwrap() / 10_u64.pow(*decimals as u32) as f64, *decimals);
    let (block_index, tx_hash) = match &v.tx_id {
        TxId::BlockIndex(block_index) => (Some(block_index.0.to_f64().unwrap()), None),
        TxId::TransactionHash(tx_hash) => (None, Some(tx_hash)),
    };
    let ts = v.ts as f64 / 1_000_000_000.0;
    let raw_json = serialize_transfer(v);

    // Use prepared statement if available
    if let Some(stmts) = prepared_statements {
        transaction
            .execute(
                stmts.insert_transfer(),
                &[
                    &transfer_id,
                    &request_id,
                    &is_send,
                    &token_id,
                    &amount,
                    &block_index,
                    &tx_hash,
                    &ts,
                    &raw_json,
                ],
            )
            .await?;
    } else {
        transaction
            .execute(
                "INSERT INTO transfers
                    (transfer_id, request_id, is_send, token_id, amount, block_index, tx_hash, ts, raw_json)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8), $9)
                    ON CONFLICT (transfer_id) DO UPDATE SET
                        request_id = $2,
                        is_send = $3,
                        token_id = $4,
                        amount = $5,
                        block_index = $6,
                        tx_hash = $7,
                        ts = to_timestamp($8),
                        raw_json = $9",
                &[
                    &transfer_id,
                    &request_id,
                    &is_send,
                    &token_id,
                    &amount,
                    &block_index,
                    &tx_hash,
                    &ts,
                    &raw_json,
                ],
            )
            .await?;
    }

    Ok(())
}

pub async fn update_transfers_on_database(db_client: &Client, tokens_map: &BTreeMap<u32, u8>) -> Result<(), Box<dyn std::error::Error>> {
    // Create cache and prepared statements once
    let cache = TransferTokenCache::new(tokens_map);
    let statements = TransferPreparedStatements::new(db_client).await?;
    
    let dir_path = "./backups";
    let re_pattern = Regex::new(r"^transfers.*.json$").unwrap();
    let mut files = fs::read_dir(dir_path)?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            if re_pattern.is_match(entry.file_name().to_str().unwrap()) {
                Some(entry)
            } else {
                None
            }
        })
        .map(|entry| {
            // sort by the number in the filename
            let file = entry.path();
            let filename = Path::new(&file).file_name().unwrap().to_str().unwrap();
            let number_str = filename.split('.').nth(1).unwrap();
            let number = number_str.parse::<u32>().unwrap();
            (number, file)
        })
        .collect::<Vec<_>>();
    files.sort_by(|a, b| a.0.cmp(&b.0));

    // Process in batches
    const BATCH_SIZE: usize = 1000;
    
    for file in files {
        let file = File::open(file.1)?;
        let reader = BufReader::new(file);
        let transfer_map: BTreeMap<StableTransferId, StableTransfer> = serde_json::from_reader(reader)?;

        // Process transfers in batches
        let mut batch = Vec::with_capacity(BATCH_SIZE);
        
        for v in transfer_map.values() {
            batch.push(v);
            
            if batch.len() >= BATCH_SIZE {
                insert_transfer_batch(db_client, &cache, &statements, &batch).await?;
                batch.clear();
            }
        }
        
        // Process remaining transfers
        if !batch.is_empty() {
            insert_transfer_batch(db_client, &cache, &statements, &batch).await?;
        }
    }

    Ok(())
}

pub async fn update_transfers_on_database_with_pool(
    pool: &Pool,
    tokens_map: &BTreeMap<u32, u8>,
) -> Result<(), Box<dyn std::error::Error>> {
    use futures::future::join_all;
    
    // Create cache once
    let cache = std::sync::Arc::new(TransferTokenCache::new(tokens_map));
    
    let dir_path = "./backups";
    let re_pattern = Regex::new(r"^transfers.*.json$").unwrap();
    let mut files = fs::read_dir(dir_path)?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            if re_pattern.is_match(entry.file_name().to_str().unwrap()) {
                Some(entry)
            } else {
                None
            }
        })
        .map(|entry| {
            let file = entry.path();
            let filename = Path::new(&file).file_name().unwrap().to_str().unwrap();
            let number_str = filename.split('.').nth(1).unwrap();
            let number = number_str.parse::<u32>().unwrap();
            (number, file)
        })
        .collect::<Vec<_>>();
    files.sort_by(|a, b| a.0.cmp(&b.0));

    // Process files concurrently with pool
    const BATCH_SIZE: usize = 1000;
    const MAX_CONCURRENT_FILES: usize = 4;
    
    for file_chunk in files.chunks(MAX_CONCURRENT_FILES) {
        let tasks: Vec<_> = file_chunk
            .iter()
            .map(|(_, path)| {
                let pool = pool.clone();
                let cache = cache.clone();
                let path = path.clone();
                
                tokio::spawn(async move {
                    process_transfer_file(pool, cache, path, BATCH_SIZE).await
                })
            })
            .collect();
        
        // Wait for all tasks in this chunk to complete
        let results = join_all(tasks).await;
        
        // Check for errors
        for result in results {
            match result {
                Ok(Ok(())) => {},
                Ok(Err(e)) => return Err(format!("Processing error: {}", e).into()),
                Err(e) => return Err(format!("Join error: {}", e).into()),
            }
        }
    }

    Ok(())
}

async fn process_transfer_file(
    pool: Pool,
    cache: std::sync::Arc<TransferTokenCache>,
    path: std::path::PathBuf,
    batch_size: usize,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let file = File::open(path)?;
    let reader = BufReader::new(file);
    let transfer_map: BTreeMap<StableTransferId, StableTransfer> = serde_json::from_reader(reader)?;

    // Get a connection from the pool
    let client = pool.get().await?;
    let statements = TransferPreparedStatements::new(&client).await
        .map_err(|e| format!("Failed to prepare statements: {}", e))?;

    // Process transfers in batches
    let mut batch = Vec::with_capacity(batch_size);
    
    for v in transfer_map.values() {
        batch.push(v);
        
        if batch.len() >= batch_size {
            insert_transfer_batch(&client, &cache, &statements, &batch).await
                .map_err(|e| format!("Failed to insert batch: {}", e))?;
            batch.clear();
        }
    }
    
    // Process remaining transfers
    if !batch.is_empty() {
        insert_transfer_batch(&client, &cache, &statements, &batch).await
            .map_err(|e| format!("Failed to insert final batch: {}", e))?;
    }

    Ok(())
}

pub async fn insert_transfer_on_database(
    v: &StableTransfer,
    db_client: &Client,
    tokens_map: &BTreeMap<u32, u8>,
) -> Result<(), Box<dyn std::error::Error>> {
    let transfer_id = v.transfer_id as i64;
    let request_id = v.request_id as i64;
    let is_send = v.is_send;
    let token_id = v.token_id as i32;
    let decimals = tokens_map.get(&v.token_id).ok_or(format!("token_id={} not found", v.token_id))?;
    let amount = round_f64(v.amount.0.to_f64().unwrap() / 10_u64.pow(*decimals as u32) as f64, *decimals);
    let (block_index, tx_hash) = match &v.tx_id {
        TxId::BlockIndex(block_index) => (Some(block_index.0.to_f64().unwrap()), None),
        TxId::TransactionHash(tx_hash) => (None, Some(tx_hash)),
    };
    let ts = v.ts as f64 / 1_000_000_000.0;
    let raw_json = serialize_transfer(v);

    db_client
        .execute(
            "INSERT INTO transfers
                (transfer_id, request_id, is_send, token_id, amount, block_index, tx_hash, ts, raw_json)
                VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8), $9)
                ON CONFLICT (transfer_id) DO UPDATE SET
                    request_id = $2,
                    is_send = $3,
                    token_id = $4,
                    amount = $5,
                    block_index = $6,
                    tx_hash = $7,
                    ts = to_timestamp($8),
                    raw_json = $9",
            &[
                &transfer_id,
                &request_id,
                &is_send,
                &token_id,
                &amount,
                &block_index,
                &tx_hash,
                &ts,
                &raw_json,
            ],
        )
        .await?;

    println!("transfer_id={} saved", v.transfer_id);

    Ok(())
}

pub async fn insert_transfer_batch(
    db_client: &Client,
    cache: &TransferTokenCache,
    statements: &TransferPreparedStatements,
    transfers: &[&StableTransfer],
) -> Result<(), Box<dyn std::error::Error>> {
    for v in transfers {
        let transfer_id = v.transfer_id as i64;
        let request_id = v.request_id as i64;
        let is_send = v.is_send;
        let token_id = v.token_id as i32;
        let decimals = cache.get_decimals(v.token_id)?;
        let amount = round_f64(v.amount.0.to_f64().unwrap() / 10_u64.pow(decimals as u32) as f64, decimals);
        let (block_index, tx_hash) = match &v.tx_id {
            TxId::BlockIndex(block_index) => (Some(block_index.0.to_f64().unwrap()), None),
            TxId::TransactionHash(tx_hash) => (None, Some(tx_hash)),
        };
        let ts = v.ts as f64 / 1_000_000_000.0;
        let raw_json = serialize_transfer(v);

        // For simplicity, we'll still use individual inserts but within a single command
        // This avoids the mutable borrow issue while still providing some performance benefit
        db_client
            .execute(
                &statements.insert_transfer,
                &[
                    &transfer_id,
                    &request_id,
                    &is_send,
                    &token_id,
                    &amount,
                    &block_index,
                    &tx_hash,
                    &ts,
                    &raw_json,
                ],
            )
            .await?;
    }
    
    println!("Batch of {} transfers saved", transfers.len());
    
    Ok(())
}

pub async fn insert_transfer_on_database_optimized(
    v: &StableTransfer,
    db_client: &Client,
    cache: &TransferTokenCache,
    statements: &TransferPreparedStatements,
) -> Result<(), Box<dyn std::error::Error>> {
    let transfer_id = v.transfer_id as i64;
    let request_id = v.request_id as i64;
    let is_send = v.is_send;
    let token_id = v.token_id as i32;
    let decimals = cache.get_decimals(v.token_id)?;
    let amount = round_f64(v.amount.0.to_f64().unwrap() / 10_u64.pow(decimals as u32) as f64, decimals);
    let (block_index, tx_hash) = match &v.tx_id {
        TxId::BlockIndex(block_index) => (Some(block_index.0.to_f64().unwrap()), None),
        TxId::TransactionHash(tx_hash) => (None, Some(tx_hash)),
    };
    let ts = v.ts as f64 / 1_000_000_000.0;
    let raw_json = serialize_transfer(v);

    // Use prepared statement
    db_client
        .execute(
            &statements.insert_transfer,
            &[
                &transfer_id,
                &request_id,
                &is_send,
                &token_id,
                &amount,
                &block_index,
                &tx_hash,
                &ts,
                &raw_json,
            ],
        )
        .await?;

    println!("transfer_id={} saved (optimized)", v.transfer_id);

    Ok(())
}

pub async fn update_transfers<T: KongUpdate>(kong_data: &T) -> Result<(), Box<dyn std::error::Error>> {
    let dir_path = "./backups";
    let re_pattern = Regex::new(r"^transfers.*.json$").unwrap();
    let mut files = fs::read_dir(dir_path)?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            if re_pattern.is_match(entry.file_name().to_str().unwrap()) {
                Some(entry)
            } else {
                None
            }
        })
        .map(|entry| {
            // sort by the number in the filename
            let file = entry.path();
            let filename = Path::new(&file).file_name().unwrap().to_str().unwrap();
            let number_str = filename.split('.').nth(1).unwrap();
            let number = number_str.parse::<u32>().unwrap();
            (number, file)
        })
        .collect::<Vec<_>>();
    files.sort_by(|a, b| a.0.cmp(&b.0));

    for file in files {
        println!("processing: {:?}", file.1.file_name().unwrap());
        let file = File::open(file.1)?;
        let mut reader = BufReader::new(file);
        let mut contents = String::new();
        reader.read_to_string(&mut contents)?;
        kong_data.update_transfers(&contents).await?;
    }

    Ok(())
}
