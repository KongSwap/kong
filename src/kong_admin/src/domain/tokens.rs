use kong_lib::stable_token::stable_token::{StableToken, StableTokenId};
use kong_lib::stable_token::token::Token;
use num_traits::ToPrimitive;
use postgres_types::{FromSql, ToSql};
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
use crate::database::prepared::PreparedStatements;

#[derive(Debug, ToSql, FromSql)]
#[postgres(name = "token_type")]
enum TokenType {
    #[postgres(name = "IC")]
    IC,
    #[postgres(name = "LP")]
    LP,
}

pub fn serialize_token(token: &StableToken) -> serde_json::Value {
    match token {
        StableToken::IC(token) => json!({
            "IC": {
                "token_id": token.token_id,
                "name": token.name,
                "symbol": token.symbol,
                "canister_id": token.canister_id.to_string(),
                "decimals": token.decimals,
                "fee": token.fee.to_string(),
                "icrc1": token.icrc1,
                "icrc2": token.icrc2,
                "icrc3": token.icrc3,
                "is_removed": token.is_removed,
            }
        }),
        StableToken::LP(token) => json!({
            "LP": {
                "token_id": token.token_id,
                "symbol": token.symbol,
                "address": token.address,
                "decimals": token.decimals,
                "is_removed": token.is_removed,
            }
        }),
    }
}

pub async fn update_tokens_on_database(db_pool: &DbPool) -> Result<BTreeMap<u32, u8>, Box<dyn std::error::Error>> {
    let dir_path = "./backups";
    let re_pattern = Regex::new(r"^tokens.*.json$").unwrap();
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
    let mut batch: Vec<StableToken> = Vec::with_capacity(BATCH_SIZE);
    let mut total_processed = 0;

    for (file_num, file_path) in files {
        println!("Processing tokens file {}: {:?}", file_num, file_path.file_name().unwrap());
        
        let file = File::open(file_path)?;
        let reader = BufReader::new(file);
        let tokens_map: BTreeMap<StableTokenId, StableToken> = serde_json::from_reader(reader)?;

        for v in tokens_map.values() {
            batch.push(v.clone());
            
            if batch.len() >= BATCH_SIZE {
                process_token_batch(db_pool, &batch).await?;
                total_processed += batch.len();
                batch.clear();
            }
        }
    }
    
    // Process remaining tokens
    if !batch.is_empty() {
        process_token_batch(db_pool, &batch).await?;
        total_processed += batch.len();
    }
    
    println!("Total tokens processed: {}", total_processed);

    load_tokens_from_database_optimized(db_pool, None).await
}

/// Process a batch of tokens with a transaction for better performance
async fn process_token_batch(
    db_pool: &DbPool,
    tokens: &[StableToken],
) -> Result<(), Box<dyn std::error::Error>> {
    if tokens.is_empty() {
        return Ok(());
    }

    // Get a connection from the pool
    let mut db_client = db_pool.get().await?;
    
    // Create prepared statements for this connection
    let prepared_statements = PreparedStatements::new(&db_client).await?;
    
    // Start a transaction
    let transaction = db_client.transaction().await?;
    
    // Process all tokens in the batch
    for token in tokens {
        if let Err(e) = insert_token_on_database_transactional(token, &transaction, Some(&prepared_statements)).await {
            // Rollback on error
            transaction.rollback().await?;
            return Err(format!("Failed to insert token {}: {}", token.token_id(), e).into());
        }
    }
    
    // Commit the transaction
    transaction.commit().await?;
    
    println!("Processed batch of {} tokens", tokens.len());
    Ok(())
}

pub async fn insert_token_on_database(v: &StableToken, db_client: &Client) -> Result<(), Box<dyn std::error::Error>> {
    insert_token_on_database_optimized(v, db_client, None).await
}

pub async fn insert_token_on_database_optimized(
    v: &StableToken, 
    db_client: &Client,
    prepared_statements: Option<&PreparedStatements>
) -> Result<(), Box<dyn std::error::Error>> {
    let (token_id, type_type, name, symbol, address, canister_id, decimals, fee, icrc1, icrc2, icrc3, is_removed, raw_json) = match v {
        StableToken::IC(token) => {
            let decimals = 10_u64.pow(token.decimals as u32) as f64;
            let fee = token.fee.0.to_f64().unwrap() / decimals;
            (
                token.token_id as i32,
                TokenType::IC,
                Some(token.name.clone()),
                token.symbol.clone(),
                None,
                Some(token.canister_id.to_string()),
                token.decimals as i16,
                Some(fee),
                Some(token.icrc1),
                Some(token.icrc2),
                Some(token.icrc3),
                token.is_removed,
                json!(serialize_token(v)),
            )
        }
        StableToken::LP(token) => (
            token.token_id as i32,
            TokenType::LP,
            None,
            token.symbol.clone(),
            Some(token.address.clone()),
            None,
            token.decimals as i16,
            None,
            None,
            None,
            None,
            token.is_removed,
            json!(serialize_token(v)),
        ),
    };

    // Use prepared statement if available
    if let Some(stmts) = prepared_statements {
        db_client
            .execute(
                stmts.insert_token(),
                &[
                    &token_id,
                    &type_type,
                    &name,
                    &symbol,
                    &address,
                    &canister_id,
                    &decimals,
                    &fee,
                    &icrc1,
                    &icrc2,
                    &icrc3,
                    &is_removed,
                    &raw_json,
                ],
            )
            .await?;
    } else {
        db_client
            .execute(
                "INSERT INTO tokens 
                    (token_id, token_type, name, symbol, address, canister_id, decimals, fee, icrc1, icrc2, icrc3, is_removed, raw_json)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                    ON CONFLICT (token_id) DO UPDATE SET
                        token_type = $2,
                        name = $3,
                        symbol = $4,
                        address = $5,
                        canister_id = $6,
                        decimals = $7,
                        fee = $8,
                        icrc1 = $9,
                        icrc2 = $10,
                        icrc3 = $11,
                        is_removed = $12,
                        raw_json = $13",
                &[
                    &token_id,
                    &type_type,
                    &name,
                    &symbol,
                    &address,
                    &canister_id,
                    &decimals,
                    &fee,
                    &icrc1,
                    &icrc2,
                    &icrc3,
                    &is_removed,
                    &raw_json,
                ],
            )
            .await?;
    }

    println!("token_id={} saved", v.token_id());

    Ok(())
}

/// Insert token using a transaction for better performance and atomicity
pub async fn insert_token_on_database_transactional(
    v: &StableToken,
    transaction: &Transaction<'_>,
    prepared_statements: Option<&PreparedStatements>
) -> Result<(), Box<dyn std::error::Error>> {
    let (token_id, type_type, name, symbol, address, canister_id, decimals, fee, icrc1, icrc2, icrc3, is_removed, raw_json) = match v {
        StableToken::IC(token) => {
            let decimals = 10_u64.pow(token.decimals as u32) as f64;
            let fee = token.fee.0.to_f64().unwrap() / decimals;
            (
                token.token_id as i32,
                TokenType::IC,
                Some(token.name.clone()),
                token.symbol.clone(),
                None,
                Some(token.canister_id.to_string()),
                token.decimals as i16,
                Some(fee),
                Some(token.icrc1),
                Some(token.icrc2),
                Some(token.icrc3),
                token.is_removed,
                json!(serialize_token(v)),
            )
        }
        StableToken::LP(token) => (
            token.token_id as i32,
            TokenType::LP,
            None,
            token.symbol.clone(),
            Some(token.address.clone()),
            None,
            token.decimals as i16,
            None,
            None,
            None,
            None,
            token.is_removed,
            json!(serialize_token(v)),
        ),
    };

    // Use prepared statement if available
    if let Some(stmts) = prepared_statements {
        transaction
            .execute(
                stmts.insert_token(),
                &[
                    &token_id,
                    &type_type,
                    &name,
                    &symbol,
                    &address,
                    &canister_id,
                    &decimals,
                    &fee,
                    &icrc1,
                    &icrc2,
                    &icrc3,
                    &is_removed,
                    &raw_json,
                ],
            )
            .await?;
    } else {
        transaction
            .execute(
                "INSERT INTO tokens 
                    (token_id, token_type, name, symbol, address, canister_id, decimals, fee, icrc1, icrc2, icrc3, is_removed, raw_json)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                    ON CONFLICT (token_id) DO UPDATE SET
                        token_type = $2,
                        name = $3,
                        symbol = $4,
                        address = $5,
                        canister_id = $6,
                        decimals = $7,
                        fee = $8,
                        icrc1 = $9,
                        icrc2 = $10,
                        icrc3 = $11,
                        is_removed = $12,
                        raw_json = $13",
                &[
                    &token_id,
                    &type_type,
                    &name,
                    &symbol,
                    &address,
                    &canister_id,
                    &decimals,
                    &fee,
                    &icrc1,
                    &icrc2,
                    &icrc3,
                    &is_removed,
                    &raw_json,
                ],
            )
            .await?;
    }

    Ok(())
}

pub async fn load_tokens_from_database(db_pool: &DbPool) -> Result<BTreeMap<u32, u8>, Box<dyn std::error::Error>> {
    load_tokens_from_database_optimized(db_pool, None).await
}

pub async fn load_tokens_from_database_optimized(
    db_pool: &DbPool,
    _prepared_statements: Option<&PreparedStatements>
) -> Result<BTreeMap<u32, u8>, Box<dyn std::error::Error>> {
    let db_client = db_pool.get().await?;
    let mut tokens_map = BTreeMap::new();
    
    // Always use a fresh query since prepared statements are connection-specific
    let rows = db_client.query("SELECT token_id, decimals FROM tokens", &[]).await?;
    
    for row in rows {
        let token_id: i32 = row.get(0);
        let decimals: i16 = row.get(1);
        tokens_map.insert(token_id as u32, decimals as u8);
    }

    Ok(tokens_map)
}

pub async fn update_tokens<T: KongUpdate>(kong_data: &T) -> Result<(), Box<dyn std::error::Error>> {
    let dir_path = "./backups";
    let re_pattern = Regex::new(r"^tokens.*.json$").unwrap();
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
        kong_data.update_tokens(&contents).await?;
    }

    Ok(())
}
