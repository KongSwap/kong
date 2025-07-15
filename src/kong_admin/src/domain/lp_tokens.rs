use kong_lib::stable_lp_token::stable_lp_token::{StableLPToken, StableLPTokenId};
use num_traits::ToPrimitive;
use regex::Regex;
use serde_json::json;
use std::collections::BTreeMap;
use std::fs;
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;
use tokio_postgres::{Client, Transaction};

use crate::database::pool::DbPool;
use crate::canister::kong_update::KongUpdate;
use crate::utils::math::round_f64;
use crate::database::prepared::PreparedStatements;

pub fn serialize_lp_tokens(lp_token: &StableLPToken) -> serde_json::Value {
    json!({
        "StableLPToken": {
            "lp_token_id": lp_token.lp_token_id,
            "user_id": lp_token.user_id,
            "token_id": lp_token.token_id,
            "amount": lp_token.amount.to_string(),
            "ts": lp_token.ts,
        }
    })
}

/// Update LP tokens using database pool with batch processing and transactions
pub async fn update_lp_tokens_on_database_with_pool_batched(
    db_pool: &DbPool,
    tokens_map: &BTreeMap<u32, u8>,
) -> Result<(), Box<dyn std::error::Error>> {
    let dir_path = "./backups";
    let re_pattern = Regex::new(r"^lp_tokens.*.json$").unwrap();
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

    // Process all files with batch transactions
    const BATCH_SIZE: usize = 1000;
    let mut batch: Vec<StableLPToken> = Vec::with_capacity(BATCH_SIZE);
    let mut total_processed = 0;
    let start_time = std::time::Instant::now();

    for (file_num, file_path) in files {
        println!("Processing LP tokens file {}: {:?}", file_num, file_path.file_name().unwrap());
        
        let file = File::open(file_path)?;
        let reader = BufReader::new(file);
        let lp_token_ledger_map: BTreeMap<StableLPTokenId, StableLPToken> = serde_json::from_reader(reader)?;

        for v in lp_token_ledger_map.values() {
            batch.push(v.clone());
            
            if batch.len() >= BATCH_SIZE {
                process_lp_token_batch(db_pool, &batch, tokens_map).await?;
                total_processed += batch.len();
                batch.clear();
                
                // Progress update
                if total_processed % 5000 == 0 {
                    let elapsed = start_time.elapsed();
                    let rate = total_processed as f64 / elapsed.as_secs_f64();
                    println!("Progress: {} LP tokens processed ({:.0} tokens/sec)", total_processed, rate);
                }
            }
        }
    }
    
    // Process remaining LP tokens
    if !batch.is_empty() {
        process_lp_token_batch(db_pool, &batch, tokens_map).await?;
        total_processed += batch.len();
    }
    
    let total_elapsed = start_time.elapsed();
    println!("All LP tokens processed. Total: {} tokens in {:.2}s ({:.0} tokens/sec)",
             total_processed, total_elapsed.as_secs_f64(), 
             total_processed as f64 / total_elapsed.as_secs_f64());

    Ok(())
}

/// Process a batch of LP tokens with a transaction for better performance
async fn process_lp_token_batch(
    db_pool: &DbPool,
    lp_tokens: &[StableLPToken],
    tokens_map: &BTreeMap<u32, u8>,
) -> Result<(), Box<dyn std::error::Error>> {
    if lp_tokens.is_empty() {
        return Ok(());
    }

    // Get a connection from the pool
    let mut db_client = db_pool.get().await?;
    
    // Create prepared statements for this connection
    let prepared_statements = PreparedStatements::new(&db_client).await?;
    
    // Start a transaction
    let transaction = db_client.transaction().await?;
    
    // Process all LP tokens in the batch
    for lp_token in lp_tokens {
        if let Err(e) = insert_lp_token_on_database_transactional(lp_token, &transaction, Some(&prepared_statements), tokens_map).await {
            // Rollback on error
            if let Err(rollback_err) = transaction.rollback().await {
                return Err(format!("Failed to insert LP token {} ({}), and rollback failed: {}", 
                                  lp_token.lp_token_id, e, rollback_err).into());
            }
            return Err(format!("Failed to insert LP token {}: {}", lp_token.lp_token_id, e).into());
        }
    }
    
    // Commit the transaction
    transaction.commit().await?;
    
    println!("✅ Processed batch of {} LP tokens", lp_tokens.len());
    Ok(())
}

/// Insert LP token using a transaction for better performance and atomicity
pub async fn insert_lp_token_on_database_transactional(
    v: &StableLPToken,
    transaction: &Transaction<'_>,
    prepared_statements: Option<&PreparedStatements>,
    tokens_map: &BTreeMap<u32, u8>,
) -> Result<(), Box<dyn std::error::Error>> {
    let lp_token_id = v.lp_token_id as i64;
    let user_id = v.user_id as i32;
    let token_id = v.token_id as i32;
    let decimals = tokens_map.get(&v.token_id).ok_or(format!("token_id={} not found", v.token_id))?;
    let amount = round_f64(v.amount.0.to_f64().unwrap() / 10_u64.pow(*decimals as u32) as f64, *decimals);
    let ts = v.ts as f64 / 1_000_000_000.0;
    let raw_json = serialize_lp_tokens(v);

    // Use prepared statement if available
    if let Some(stmts) = prepared_statements {
        transaction
            .execute(
                stmts.insert_lp_token(),
                &[&lp_token_id, &user_id, &token_id, &amount, &ts, &raw_json],
            )
            .await?;
    } else {
        transaction
            .execute(
                "INSERT INTO lp_tokens 
                    (lp_token_id, user_id, token_id, amount, ts, raw_json)
                    VALUES ($1, $2, $3, $4, to_timestamp($5), $6)
                    ON CONFLICT (lp_token_id) DO UPDATE SET
                        user_id = $2,
                        token_id = $3,
                        amount = $4,
                        ts = to_timestamp($5),
                        raw_json = $6",
                &[&lp_token_id, &user_id, &token_id, &amount, &ts, &raw_json],
            )
            .await?;
    }

    Ok(())
}

pub async fn update_lp_tokens_on_database(db_client: &Client, tokens_map: &BTreeMap<u32, u8>) -> Result<(), Box<dyn std::error::Error>> {
    let dir_path = "./backups";
    let re_pattern = Regex::new(r"^lp_tokens.*.json$").unwrap();
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
        let file = File::open(file.1)?;
        let reader = BufReader::new(file);
        let lp_token_ledger_map: BTreeMap<StableLPTokenId, StableLPToken> = serde_json::from_reader(reader)?;

        for v in lp_token_ledger_map.values() {
            insert_lp_token_on_database(v, db_client, tokens_map).await?;
        }
    }

    Ok(())
}

pub async fn insert_lp_token_on_database(
    v: &StableLPToken,
    db_client: &Client,
    tokens_map: &BTreeMap<u32, u8>,
) -> Result<(), Box<dyn std::error::Error>> {
    let lp_token_id = v.lp_token_id as i64;
    let user_id = v.user_id as i32;
    let token_id = v.token_id as i32;
    let decimals = tokens_map.get(&v.token_id).ok_or(format!("token_id={} not found", v.token_id))?;
    let amount = round_f64(v.amount.0.to_f64().unwrap() / 10_u64.pow(*decimals as u32) as f64, *decimals);
    let ts = v.ts as f64 / 1_000_000_000.0;
    let raw_json = serialize_lp_tokens(v);

    db_client
        .execute(
            "INSERT INTO lp_tokens 
                (lp_token_id, user_id, token_id, amount, ts, raw_json)
                VALUES ($1, $2, $3, $4, to_timestamp($5), $6)
                ON CONFLICT (lp_token_id) DO UPDATE SET
                    user_id = $2,
                    token_id = $3,
                    amount = $4,
                    ts = to_timestamp($5),
                    raw_json = $6",
            &[&lp_token_id, &user_id, &token_id, &amount, &ts, &raw_json],
        )
        .await?;

    // Reduced logging for batch operations to avoid spam
    if v.lp_token_id % 1000 == 0 {
        println!("lp_token_id={} saved (progress indicator)", v.lp_token_id);
    }

    Ok(())
}

pub async fn update_lp_tokens<T: KongUpdate>(kong_update: &T) -> Result<(), Box<dyn std::error::Error>> {
    let dir_path = "./backups";
    let re_pattern = Regex::new(r"^lp_tokens.*.json$").unwrap();
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
        kong_update.update_lp_tokens(&contents).await?;
    }

    Ok(())
}
