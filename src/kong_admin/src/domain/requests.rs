use kong_lib::stable_request::reply::Reply;
use kong_lib::stable_request::request::Request;
use kong_lib::stable_request::stable_request::{StableRequest, StableRequestId};
use kong_lib::transfers::transfer_reply::TransferReply;
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
use crate::utils::nat::nat_option_to_string;
use super::transfers::serialize_option_tx_id;

#[derive(Debug, ToSql, FromSql)]
#[postgres(name = "request_type")]
enum RequestType {
    #[postgres(name = "add_pool")]
    AddPool,
    #[postgres(name = "add_liquidity")]
    AddLiquidity,
    #[postgres(name = "remove_liquidity")]
    RemoveLiquidity,
    #[postgres(name = "swap")]
    Swap,
    #[postgres(name = "claim")]
    Claim,
    #[postgres(name = "send")]
    Send,
}

pub fn serialize_request(request: &Request) -> serde_json::Value {
    match &request {
        Request::AddPool(request) => json!({
            "AddPoolArgs": {
                "token_0": request.token_0,
                "amount_0": request.amount_0.to_string(),
                "tx_id_0": serialize_option_tx_id(request.tx_id_0.as_ref()),
                "token_1": request.token_1,
                "amount_1": request.amount_1.to_string(),
                "tx_id_1": serialize_option_tx_id(request.tx_id_1.as_ref()),
                "lp_fee_bps": request.lp_fee_bps,
            }
        }),
        Request::AddLiquidity(request) => json!({
            "AddLiquidtyArgs": {
                "token_0": request.token_0,
                "amount_0": request.amount_0.to_string(),
                "tx_id_0": serialize_option_tx_id(request.tx_id_0.as_ref()),
                "token_1": request.token_1,
                "amount_1": request.amount_1.to_string(),
                "tx_id_1": serialize_option_tx_id(request.tx_id_1.as_ref()),
            }
        }),
        Request::RemoveLiquidity(request) => json!({
            "RemoveLiquidityArgs": {
                "token_0": request.token_0,
                "token_1": request.token_1,
                "remove_lp_token_amount": request.remove_lp_token_amount.to_string(),
            }
        }),
        Request::Swap(request) => json!({
            "SwapArgs": {
                "pay_token": request.pay_token,
                "pay_amount": request.pay_amount.to_string(),
                "pay_tx_id": serialize_option_tx_id(request.pay_tx_id.as_ref()),
                "receive_token": request.receive_token,
                "receive_amount": nat_option_to_string(request.receive_amount.as_ref()),
                "receive_address": request.receive_address,
                "max_slippage": request.max_slippage,
                "referred_by": request.referred_by,
            }
        }),
        Request::Claim(claim_id) => json!({
            "claim_id": claim_id,
        }),
        Request::Send(request) => json!({
            "SendArgs": {
                "token": request.token,
                "amount": request.amount.to_string(),
                "to_address": request.to_address,
            }
        }),
    }
}

pub fn serialize_reply(reply: &Reply) -> serde_json::Value {
    match &reply {
        Reply::Pending => json!("Pending"),
        Reply::AddPool(reply) => json!({
            "AddPoolReply": {
                "tx_id": reply.tx_id,
                "pool_id": reply.pool_id,
                "request_id": reply.request_id,
                "status": reply.status,
                "name": reply.name,
                "symbol": reply.symbol,
                "chain_0": reply.chain_0,
                "address_0": reply.address_0,
                "symbol_0": reply.symbol_0,
                "amount_0": reply.amount_0.to_string(),
                "balance_0": reply.balance_0.to_string(),
                "chain_1": reply.chain_1,
                "address_1": reply.address_1,
                "symbol_1": reply.symbol_1,
                "amount_1": reply.amount_1.to_string(),
                "balance_1": reply.balance_1.to_string(),
                "add_lp_token_amount": reply.add_lp_token_amount.to_string(),
                "lp_fee_bps": reply.lp_fee_bps,
                "lp_token_symbol": reply.lp_token_symbol,
                "transfer_ids": reply.transfer_ids.iter().map(|id| json!({
                    "transfer_id": id.transfer_id,
                    "transfer": match &id.transfer {
                        TransferReply::IC(transfer_reply) => json!({
                            "chain": transfer_reply.chain,
                            "symbol": transfer_reply.symbol,
                            "is_send": transfer_reply.is_send,
                            "amount": transfer_reply.amount.to_string(),
                            "canister_id": transfer_reply.canister_id,
                            "block_index": transfer_reply.block_index.to_string(),
                        }),
                    },
                })).collect::<Vec<_>>(),
                "claim_ids": reply.claim_ids,
                "is_removed": reply.is_removed,
                "ts": reply.ts,
            }
        }),
        Reply::AddLiquidity(reply) => json!({
            "AddLiquidityReply": {
                "tx_id": reply.tx_id,
                "request_id": reply.request_id,
                "status": reply.status,
                "symbol": reply.symbol,
                "chain_0": reply.chain_0,
                "address_0": reply.address_0,
                "symbol_0": reply.symbol_0,
                "amount_0": reply.amount_0.to_string(),
                "chain_1": reply.chain_1,
                "address_1": reply.address_1,
                "symbol_1": reply.symbol_1,
                "amount_1": reply.amount_1.to_string(),
                "add_lp_token_amount": reply.add_lp_token_amount.to_string(),
                "transfer_ids": reply.transfer_ids.iter().map(|id| json!({
                    "transfer_id": id.transfer_id,
                    "transfer": match &id.transfer {
                        TransferReply::IC(transfer_reply) => json!({
                            "chain": transfer_reply.chain,
                            "symbol": transfer_reply.symbol,
                            "is_send": transfer_reply.is_send,
                            "amount": transfer_reply.amount.to_string(),
                            "canister_id": transfer_reply.canister_id,
                            "block_index": transfer_reply.block_index.to_string(),
                        }),
                    },
                })).collect::<Vec<_>>(),
                "claim_ids": reply.claim_ids,
                "ts": reply.ts,
            }
        }),
        Reply::RemoveLiquidity(reply) => json!({
            "RemoveLiquidityReply": {
                "tx_id": reply.tx_id,
                "request_id": reply.request_id,
                "status": reply.status,
                "symbol": reply.symbol,
                "chain_0": reply.chain_0,
                "address_0": reply.address_0,
                "symbol_0": reply.symbol_0,
                "amount_0": reply.amount_0.to_string(),
                "lp_fee_0": reply.lp_fee_0.to_string(),
                "chain_1": reply.chain_1,
                "address_1": reply.address_1,
                "symbol_1": reply.symbol_1,
                "amount_1": reply.amount_1.to_string(),
                "lp_fee_1": reply.lp_fee_1.to_string(),
                "remove_lp_token_amount": reply.remove_lp_token_amount.to_string(),
                "transfer_ids": reply.transfer_ids.iter().map(|id| json!({
                    "transfer_id": id.transfer_id,
                    "transfer": match &id.transfer {
                        TransferReply::IC(transfer_reply) => json!({
                            "chain": transfer_reply.chain,
                            "symbol": transfer_reply.symbol,
                            "is_send": transfer_reply.is_send,
                            "amount": transfer_reply.amount.to_string(),
                            "canister_id": transfer_reply.canister_id,
                            "block_index": transfer_reply.block_index.to_string(),
                        }),
                    },
                })).collect::<Vec<_>>(),
                "claim_ids": reply.claim_ids,
                "ts": reply.ts,
            }
        }),
        Reply::Swap(reply) => json!({
            "SwapReply": {
                "tx_id": reply.tx_id,
                "request_id": reply.request_id,
                "status": reply.status,
                "pay_chain": reply.pay_chain,
                "pay_symbol": reply.pay_symbol,
                "pay_amount": reply.pay_amount.to_string(),
                "receive_chain": reply.receive_chain,
                "receive_symbol": reply.receive_symbol,
                "receive_amount": reply.receive_amount.to_string(),
                "mid_price": reply.mid_price,
                "price": reply.price,
                "slippage": reply.slippage,
                "txs": reply.txs.iter().map(|tx| json!({
                    "pool_symbol": tx.pool_symbol,
                    "pay_chain": tx.pay_chain,
                    "pay_symbol": tx.pay_symbol,
                    "pay_amount": tx.pay_amount.to_string(),
                    "receive_chain": tx.receive_chain,
                    "receive_symbol": tx.receive_symbol,
                    "receive_amount": tx.receive_amount.to_string(),
                    "price": tx.price,
                    "lp_fee": tx.lp_fee.to_string(),
                    "gas_fee": tx.gas_fee.to_string(),
                    "ts": tx.ts,
                })).collect::<Vec<_>>(),
                "transfer_ids": reply.transfer_ids.iter().map(|id| json!({
                    "transfer_id": id.transfer_id,
                    "transfer": match &id.transfer {
                        TransferReply::IC(transfer_reply) => json!({
                            "chain": transfer_reply.chain,
                            "symbol": transfer_reply.symbol,
                            "is_send": transfer_reply.is_send,
                            "amount": transfer_reply.amount.to_string(),
                            "canister_id": transfer_reply.canister_id,
                            "block_index": transfer_reply.block_index.to_string(),
                        }),
                    },
                })).collect::<Vec<_>>(),
                "claim_ids": reply.claim_ids,
                "ts": reply.ts,
            }
        }),
        Reply::Claim(reply) => json!({
            "ClaimReply": {
                "claim_id": reply.claim_id,
                "status": reply.status,
                "chain": reply.chain,
                "symbol": reply.symbol,
                "amount": reply.amount.to_string(),
                "fee": reply.fee.to_string(),
                "to_address": reply.to_address,
                "transfer_ids": reply.transfer_ids.iter().map(|id| json!({
                    "transfer_id": id.transfer_id,
                    "transfer": match &id.transfer {
                        TransferReply::IC(transfer_reply) => json!({
                            "chain": transfer_reply.chain,
                            "symbol": transfer_reply.symbol,
                            "is_send": transfer_reply.is_send,
                            "amount": transfer_reply.amount.to_string(),
                            "canister_id": transfer_reply.canister_id,
                            "block_index": transfer_reply.block_index.to_string(),
                        }),
                    },
                })).collect::<Vec<_>>(),
                "ts": reply.ts,
            }
        }),
        Reply::Send(reply) => json!({
            "SendReply": {
                "tx_id": reply.tx_id,
                "request_id": reply.request_id,
                "status": reply.status,
                "chain": reply.chain,
                "symbol": reply.symbol,
                "amount": reply.amount.to_string(),
                "to_address": reply.to_address,
                "ts": reply.ts,
            }
        }),
    }
}

/// Process a batch of requests efficiently using database transactions
async fn process_request_batch(
    requests: &[StableRequest],
    db_pool: &DbPool,
    prepared_statements: Option<&PreparedStatements>,
) -> Result<(), Box<dyn std::error::Error>> {
    if requests.is_empty() {
        return Ok(());
    }

    let mut db_client = db_pool.get().await?;
    
    // Start a transaction for the entire batch
    let transaction = db_client.transaction().await?;
    
    // Try bulk insert first for better performance
    match bulk_insert_requests(&requests, &transaction).await {
        Ok(_) => {
            // Bulk insert succeeded
            transaction.commit().await?;
            println!("Bulk processed batch of {} requests", requests.len());
            return Ok(());
        }
        Err(_) => {
            // Fall back to individual inserts if bulk insert fails
            // This handles cases where some records might have conflicts
        }
    }
    
    // Fallback: Process all requests individually in the batch within the transaction
    let mut processed = 0;
    for request in requests {
        match if let Some(stmts) = prepared_statements {
            insert_request_on_database_transactional(request, &transaction, Some(stmts)).await
        } else {
            insert_request_on_database_transactional(request, &transaction, None).await
        } {
            Ok(_) => processed += 1,
            Err(e) => {
                // Rollback the transaction on error
                transaction.rollback().await?;
                return Err(format!("Failed to insert request {}: {}", request.request_id, e).into());
            }
        }
    }
    
    // Commit the transaction if all inserts succeeded
    transaction.commit().await?;
    
    println!("Processed batch of {} requests", processed);
    Ok(())
}

/// Process requests from a file in batches
async fn process_requests_from_file(
    file_path: &Path,
    db_pool: &DbPool,
    batch_size: usize,
    prepared_statements: Option<&PreparedStatements>,
) -> Result<usize, Box<dyn std::error::Error>> {
    let file = File::open(file_path)?;
    let reader = BufReader::new(file);
    
    // Parse the BTreeMap
    let request_map: BTreeMap<StableRequestId, StableRequest> = serde_json::from_reader(reader)?;
    let total_count = request_map.len();
    
    // Process in batches
    let mut batch = Vec::with_capacity(batch_size);
    let mut processed = 0;
    
    for (_id, request) in request_map {
        batch.push(request);
        
        if batch.len() >= batch_size {
            process_request_batch(&batch, db_pool, prepared_statements).await?;
            processed += batch.len();
            batch.clear();
            
            // Progress update
            if processed % 10000 == 0 {
                println!("Progress: {}/{} requests processed", processed, total_count);
            }
        }
    }
    
    // Process remaining requests
    if !batch.is_empty() {
        process_request_batch(&batch, db_pool, prepared_statements).await?;
        processed += batch.len();
    }
    
    Ok(processed)
}


pub async fn update_requests_on_database(db_pool: &DbPool) -> Result<(), Box<dyn std::error::Error>> {
    // Increased batch size for better transaction performance
    // Larger batches mean fewer transaction commits, improving throughput
    update_requests_on_database_streaming(db_pool, 5000).await
}

/// Update requests using streaming JSON parser for better memory efficiency
pub async fn update_requests_on_database_streaming(
    db_pool: &DbPool,
    batch_size: usize,
) -> Result<(), Box<dyn std::error::Error>> {
    let dir_path = "./backups";
    let re_pattern = Regex::new(r"^requests.*.json$").unwrap();
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

    // Create a single connection and prepare statements once
    let db_client = db_pool.get().await?;
    let prepared_statements = PreparedStatements::new(&db_client).await?;

    // Track total progress
    let mut total_processed = 0;
    let start_time = std::time::Instant::now();

    // Process each file using streaming with optimized batch size
    for (file_num, file_path) in files {
        println!("Processing file {}: {:?}", file_num, file_path.file_name().unwrap());
        
        let file_processed = process_requests_from_file(
            &file_path, 
            db_pool, 
            batch_size,
            Some(&prepared_statements)
        ).await?;
        
        total_processed += file_processed;
        let elapsed = start_time.elapsed();
        let rate = total_processed as f64 / elapsed.as_secs_f64();
        
        println!("Completed file {} - Total processed: {} requests ({:.0} req/sec)", 
                 file_num, total_processed, rate);
    }

    let total_elapsed = start_time.elapsed();
    println!("All files processed. Total: {} requests in {:.2}s ({:.0} req/sec)",
             total_processed, total_elapsed.as_secs_f64(), 
             total_processed as f64 / total_elapsed.as_secs_f64());

    Ok(())
}

pub async fn insert_request_on_database(v: &StableRequest, db_client: &Client) -> Result<(), Box<dyn std::error::Error>> {
    insert_request_on_database_optimized(v, db_client, None).await
}

pub async fn insert_request_on_database_optimized(
    v: &StableRequest, 
    db_client: &Client,
    prepared_statements: Option<&PreparedStatements>
) -> Result<(), Box<dyn std::error::Error>> {
    // Convert common fields once
    let request_id = v.request_id as i64;
    let user_id = v.user_id as i32;
    let request_type = match &v.request {
        Request::AddPool(_) => RequestType::AddPool,
        Request::AddLiquidity(_) => RequestType::AddLiquidity,
        Request::RemoveLiquidity(_) => RequestType::RemoveLiquidity,
        Request::Swap(_) => RequestType::Swap,
        Request::Claim(_) => RequestType::Claim,
        Request::Send(_) => RequestType::Send,
    };
    let request = serialize_request(&v.request);
    let reply = serialize_reply(&v.reply);
    let statuses = json!(&v.statuses);
    let ts = v.ts as f64 / 1_000_000_000.0;

    // Use prepared statement if available, otherwise fall back to execute
    if let Some(stmts) = prepared_statements {
        db_client
            .execute(
                stmts.insert_request(),
                &[&request_id, &user_id, &request_type, &request, &reply, &statuses, &ts],
            )
            .await?;
    } else {
        db_client
            .execute(
                "INSERT INTO requests
                    (request_id, user_id, request_type, request, reply, statuses, ts)
                    VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7))
                    ON CONFLICT (request_id) DO UPDATE SET
                        user_id = $2,
                        request_type = $3,
                        request = $4,
                        reply = $5,
                        statuses = $6,
                        ts = to_timestamp($7)",
                &[&request_id, &user_id, &request_type, &request, &reply, &statuses, &ts],
            )
            .await?;
    }

    // Only print every 500th record to reduce I/O overhead
    if request_id % 10000 == 0 {
        println!("request_id={} saved (batch progress)", v.request_id);
    }

    Ok(())
}

/// Bulk insert multiple requests in a single query for maximum performance
async fn bulk_insert_requests(
    requests: &[StableRequest],
    transaction: &Transaction<'_>,
) -> Result<(), Box<dyn std::error::Error>> {
    if requests.is_empty() {
        return Ok(());
    }
    
    // Build the bulk insert query
    let mut query = String::from(
        "INSERT INTO requests (request_id, user_id, request_type, request, reply, statuses, ts) VALUES "
    );
    
    let mut params: Vec<Box<dyn tokio_postgres::types::ToSql + Sync>> = Vec::new();
    let mut param_placeholders = Vec::new();
    
    for (idx, request) in requests.iter().enumerate() {
        let base_idx = idx * 7;
        
        // Convert fields
        let request_id = request.request_id as i64;
        let user_id = request.user_id as i32;
        let request_type = match &request.request {
            Request::AddPool(_) => RequestType::AddPool,
            Request::AddLiquidity(_) => RequestType::AddLiquidity,
            Request::RemoveLiquidity(_) => RequestType::RemoveLiquidity,
            Request::Swap(_) => RequestType::Swap,
            Request::Claim(_) => RequestType::Claim,
            Request::Send(_) => RequestType::Send,
        };
        let req_json = serialize_request(&request.request);
        let reply_json = serialize_reply(&request.reply);
        let statuses_json = json!(&request.statuses);
        let ts = request.ts as f64 / 1_000_000_000.0;
        
        // Add parameters
        params.push(Box::new(request_id));
        params.push(Box::new(user_id));
        params.push(Box::new(request_type));
        params.push(Box::new(req_json));
        params.push(Box::new(reply_json));
        params.push(Box::new(statuses_json));
        params.push(Box::new(ts));
        
        // Build placeholder string
        param_placeholders.push(format!(
            "(${}, ${}, ${}, ${}, ${}, ${}, to_timestamp(${}))",
            base_idx + 1, base_idx + 2, base_idx + 3, base_idx + 4, 
            base_idx + 5, base_idx + 6, base_idx + 7
        ));
    }
    
    query.push_str(&param_placeholders.join(", "));
    query.push_str(" ON CONFLICT (request_id) DO UPDATE SET ");
    query.push_str("user_id = EXCLUDED.user_id, ");
    query.push_str("request_type = EXCLUDED.request_type, ");
    query.push_str("request = EXCLUDED.request, ");
    query.push_str("reply = EXCLUDED.reply, ");
    query.push_str("statuses = EXCLUDED.statuses, ");
    query.push_str("ts = EXCLUDED.ts");
    
    // Convert params to references for the query
    let param_refs: Vec<&(dyn tokio_postgres::types::ToSql + Sync)> = 
        params.iter().map(|p| p.as_ref()).collect();
    
    transaction.execute(&query, &param_refs).await?;
    
    Ok(())
}

/// Insert request using a transaction for better performance and atomicity
pub async fn insert_request_on_database_transactional(
    v: &StableRequest,
    transaction: &Transaction<'_>,
    prepared_statements: Option<&PreparedStatements>
) -> Result<(), Box<dyn std::error::Error>> {
    // Convert common fields once
    let request_id = v.request_id as i64;
    let user_id = v.user_id as i32;
    let request_type = match &v.request {
        Request::AddPool(_) => RequestType::AddPool,
        Request::AddLiquidity(_) => RequestType::AddLiquidity,
        Request::RemoveLiquidity(_) => RequestType::RemoveLiquidity,
        Request::Swap(_) => RequestType::Swap,
        Request::Claim(_) => RequestType::Claim,
        Request::Send(_) => RequestType::Send,
    };
    let request = serialize_request(&v.request);
    let reply = serialize_reply(&v.reply);
    let statuses = json!(&v.statuses);
    let ts = v.ts as f64 / 1_000_000_000.0;

    // Use prepared statement if available, otherwise fall back to execute
    if let Some(stmts) = prepared_statements {
        transaction
            .execute(
                stmts.insert_request(),
                &[&request_id, &user_id, &request_type, &request, &reply, &statuses, &ts],
            )
            .await?;
    } else {
        transaction
            .execute(
                "INSERT INTO requests
                    (request_id, user_id, request_type, request, reply, statuses, ts)
                    VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7))
                    ON CONFLICT (request_id) DO UPDATE SET
                        user_id = $2,
                        request_type = $3,
                        request = $4,
                        reply = $5,
                        statuses = $6,
                        ts = to_timestamp($7)",
                &[&request_id, &user_id, &request_type, &request, &reply, &statuses, &ts],
            )
            .await?;
    }

    Ok(())
}

pub async fn update_requests<T: KongUpdate>(kong_update: &T) -> Result<(), Box<dyn std::error::Error>> {
    let dir_path = "./backups";
    let re_pattern = Regex::new(r"^requests.*.json$").unwrap();
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
        let mut reader = BufReader::new(file);
        let mut contents = String::new();
        reader.read_to_string(&mut contents)?;
        kong_update.update_requests(&contents).await?;
    }

    Ok(())
}
