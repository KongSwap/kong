use kong_lib::stable_user::stable_user::{StableUser, StableUserId};
use regex::Regex;
use serde_json::json;
use std::collections::BTreeMap;
use std::fs;
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;
use tokio_postgres::{Client, Statement, Transaction};
use deadpool_postgres::Pool;

use crate::database::pool::DbPool;
use crate::canister::kong_update::KongUpdate;
use crate::database::prepared::PreparedStatements;

pub struct UserPreparedStatements {
    check_existing_user: Statement,
    check_principal_conflict: Statement,
    check_principal_exists: Statement,
    insert_user: Statement,
}

impl UserPreparedStatements {
    pub async fn new(client: &Client) -> Result<Self, Box<dyn std::error::Error>> {
        Ok(Self {
            check_existing_user: client
                .prepare("SELECT principal_id FROM users WHERE user_id = $1")
                .await?,
            check_principal_conflict: client
                .prepare("SELECT user_id FROM users WHERE principal_id = $1 AND user_id != $2")
                .await?,
            check_principal_exists: client
                .prepare("SELECT user_id FROM users WHERE principal_id = $1")
                .await?,
            insert_user: client
                .prepare(
                    "INSERT INTO users 
                        (user_id, principal_id, my_referral_code, referred_by, referred_by_expires_at, fee_level, fee_level_expires_at, raw_json)
                        VALUES ($1, $2, $3, $4, to_timestamp($5), $6, to_timestamp($7), $8)
                        ON CONFLICT (user_id) DO UPDATE SET
                            principal_id = $2,
                            my_referral_code = $3,
                            referred_by = $4,
                            referred_by_expires_at = to_timestamp($5),
                            fee_level = $6,
                            fee_level_expires_at = to_timestamp($7),
                            raw_json = $8",
                )
                .await?,
        })
    }
}

/// Update users using database pool with batch processing and transactions
pub async fn update_users_on_database_with_pool_batched(db_pool: &DbPool) -> Result<(), Box<dyn std::error::Error>> {
    let dir_path = "./backups";
    let re_pattern = Regex::new(r"^users.*.json$").unwrap();
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
    let mut batch: Vec<StableUser> = Vec::with_capacity(BATCH_SIZE);
    let mut total_processed = 0;
    let start_time = std::time::Instant::now();

    for (file_num, file_path) in files {
        println!("Processing users file {}: {:?}", file_num, file_path.file_name().unwrap());
        
        let file = File::open(file_path)?;
        let reader = BufReader::new(file);
        let users_map: BTreeMap<StableUserId, StableUser> = serde_json::from_reader(reader)?;

        for v in users_map.values() {
            batch.push(v.clone());
            
            if batch.len() >= BATCH_SIZE {
                process_user_batch(db_pool, &batch).await?;
                total_processed += batch.len();
                batch.clear();
                
                // Progress update
                if total_processed % 5000 == 0 {
                    let elapsed = start_time.elapsed();
                    let rate = total_processed as f64 / elapsed.as_secs_f64();
                    println!("Progress: {} users processed ({:.0} users/sec)", total_processed, rate);
                }
            }
        }
    }
    
    // Process remaining users
    if !batch.is_empty() {
        process_user_batch(db_pool, &batch).await?;
        total_processed += batch.len();
    }
    
    let total_elapsed = start_time.elapsed();
    println!("All users processed. Total: {} users in {:.2}s ({:.0} users/sec)",
             total_processed, total_elapsed.as_secs_f64(), 
             total_processed as f64 / total_elapsed.as_secs_f64());

    Ok(())
}

/// Process a batch of users with a transaction for better performance
async fn process_user_batch(
    db_pool: &DbPool,
    users: &[StableUser],
) -> Result<(), Box<dyn std::error::Error>> {
    if users.is_empty() {
        return Ok(());
    }

    // Get a connection from the pool
    let mut db_client = db_pool.get().await?;
    
    // Create prepared statements for this connection
    let prepared_statements = PreparedStatements::new(&db_client).await?;
    
    // Start a transaction
    let transaction = db_client.transaction().await?;
    
    // Process all users in the batch
    for user in users {
        if let Err(e) = insert_user_on_database_transactional(user, &transaction, Some(&prepared_statements)).await {
            // Rollback on error
            transaction.rollback().await?;
            return Err(format!("Failed to insert user {}: {}", user.user_id, e).into());
        }
    }
    
    // Commit the transaction
    transaction.commit().await?;
    
    println!("Processed batch of {} users", users.len());
    Ok(())
}

/// Insert user using a transaction for better performance and atomicity
pub async fn insert_user_on_database_transactional(
    v: &StableUser,
    transaction: &Transaction<'_>,
    prepared_statements: Option<&PreparedStatements>
) -> Result<(), Box<dyn std::error::Error>> {
    let user_id = v.user_id as i32;
    let referred_by = v.referred_by.map(|x| x as i32);
    let referred_by_expires_at = v.referred_by_expires_at.map(|x| x as f64 / 1_000_000_000.0);
    let fee_level = v.fee_level as i16;
    let fee_level_expires_at = v.fee_level_expires_at.map(|x| x as f64 / 1_000_000_000.0);
    let raw_json = json!({ "StableUser": &v} );

    // Use a savepoint to handle potential constraint violations without aborting the main transaction
    let savepoint_name = format!("sp_user_{}", user_id);
    transaction.execute(&format!("SAVEPOINT {}", savepoint_name), &[]).await?;

    // First attempt with the original principal_id
    let principal_id = &v.principal_id;
    
    let result = if let Some(stmts) = prepared_statements {
        transaction
            .execute(
                stmts.insert_user(),
                &[
                    &user_id,
                    &principal_id,
                    &v.my_referral_code,
                    &referred_by,
                    &referred_by_expires_at,
                    &fee_level,
                    &fee_level_expires_at,
                    &raw_json,
                ],
            )
            .await
    } else {
        transaction
            .execute(
                "INSERT INTO users 
                    (user_id, principal_id, my_referral_code, referred_by, referred_by_expires_at, fee_level, fee_level_expires_at, raw_json)
                    VALUES ($1, $2, $3, $4, to_timestamp($5), $6, to_timestamp($7), $8)
                    ON CONFLICT (user_id) DO UPDATE SET
                        principal_id = $2,
                        my_referral_code = $3,
                        referred_by = $4,
                        referred_by_expires_at = to_timestamp($5),
                        fee_level = $6,
                        fee_level_expires_at = to_timestamp($7),
                        raw_json = $8",
                &[
                    &user_id,
                    &principal_id,
                    &v.my_referral_code,
                    &referred_by,
                    &referred_by_expires_at,
                    &fee_level,
                    &fee_level_expires_at,
                    &raw_json,
                ],
            )
            .await
    };

    match result {
        Ok(_) => {
            // Success - release the savepoint
            transaction.execute(&format!("RELEASE SAVEPOINT {}", savepoint_name), &[]).await?;
            Ok(())
        }
        Err(e) if e.to_string().contains("duplicate key value violates unique constraint \"users_principal_id_key\"") => {
            // Rollback to savepoint to clear the error state
            transaction.execute(&format!("ROLLBACK TO SAVEPOINT {}", savepoint_name), &[]).await?;
            
            // Handle duplicate by appending user_id
            let fallback_principal_id = format!("{}_{}", v.principal_id, user_id);
            
            // Try the fallback insert
            let fallback_result = if let Some(stmts) = prepared_statements {
                transaction
                    .execute(
                        stmts.insert_user(),
                        &[
                            &user_id,
                            &fallback_principal_id,
                            &v.my_referral_code,
                            &referred_by,
                            &referred_by_expires_at,
                            &fee_level,
                            &fee_level_expires_at,
                            &raw_json,
                        ],
                    )
                    .await
            } else {
                transaction
                    .execute(
                        "INSERT INTO users 
                            (user_id, principal_id, my_referral_code, referred_by, referred_by_expires_at, fee_level, fee_level_expires_at, raw_json)
                            VALUES ($1, $2, $3, $4, to_timestamp($5), $6, to_timestamp($7), $8)
                            ON CONFLICT (user_id) DO UPDATE SET
                                principal_id = $2,
                                my_referral_code = $3,
                                referred_by = $4,
                                referred_by_expires_at = to_timestamp($5),
                                fee_level = $6,
                                fee_level_expires_at = to_timestamp($7),
                                raw_json = $8",
                        &[
                            &user_id,
                            &fallback_principal_id,
                            &v.my_referral_code,
                            &referred_by,
                            &referred_by_expires_at,
                            &fee_level,
                            &fee_level_expires_at,
                            &raw_json,
                        ],
                    )
                    .await
            };
                
            match fallback_result {
                Ok(_) => {
                    // Release the savepoint
                    transaction.execute(&format!("RELEASE SAVEPOINT {}", savepoint_name), &[]).await?;
                    
                    println!("⚠️  user_id={} saved with modified principal_id: {} (original: {})", 
                             v.user_id, fallback_principal_id, v.principal_id);
                    Ok(())
                },
                Err(fallback_err) => {
                    // Rollback to savepoint and release it
                    transaction.execute(&format!("ROLLBACK TO SAVEPOINT {}", savepoint_name), &[]).await?;
                    transaction.execute(&format!("RELEASE SAVEPOINT {}", savepoint_name), &[]).await?;
                    
                    Err(format!("Failed to insert user {} with both original and fallback principal_ids. Original error: {}, Fallback error: {}", 
                               v.user_id, e, fallback_err).into())
                }
            }
        }
        Err(e) => {
            // Rollback to savepoint and release it for any other error
            transaction.execute(&format!("ROLLBACK TO SAVEPOINT {}", savepoint_name), &[]).await?;
            transaction.execute(&format!("RELEASE SAVEPOINT {}", savepoint_name), &[]).await?;
            Err(e.into())
        }
    }
}

pub async fn update_users_on_database(db_client: &Client) -> Result<(), Box<dyn std::error::Error>> {
    let dir_path = "./backups";
    let re_pattern = Regex::new(r"^users.*.json$").unwrap();
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
        let user_map: BTreeMap<StableUserId, StableUser> = serde_json::from_reader(reader)?;

        for v in user_map.values() {
            insert_user_on_database(v, db_client).await?;
        }
    }

    Ok(())
}

pub async fn update_users_on_database_with_pool(
    pool: &Pool,
) -> Result<(), Box<dyn std::error::Error>> {
    use futures::future::join_all;
    
    let dir_path = "./backups";
    let re_pattern = Regex::new(r"^users.*.json$").unwrap();
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

    let total_files = files.len();
    println!("🚀 Starting batch processing of {} user files", total_files);
    
    // Process files concurrently with pool
    const BATCH_SIZE: usize = 1000;
    const MAX_CONCURRENT_FILES: usize = 4;
    
    let overall_start = std::time::Instant::now();
    let mut files_processed = 0;
    
    for file_chunk in files.chunks(MAX_CONCURRENT_FILES) {
        let tasks: Vec<_> = file_chunk
            .iter()
            .map(|(_, path)| {
                let pool = pool.clone();
                let path = path.clone();
                
                tokio::spawn(async move {
                    process_user_file(pool, path, BATCH_SIZE).await
                })
            })
            .collect();
        
        // Wait for all tasks in this chunk to complete
        let results = join_all(tasks).await;
        
        // Check for errors
        for result in results {
            match result {
                Ok(Ok(())) => {
                    files_processed += 1;
                    if files_processed % 2 == 0 {
                        let elapsed = overall_start.elapsed();
                        println!("🔄 Overall progress: {}/{} files completed ({:.1}s elapsed)", 
                                files_processed, total_files, elapsed.as_secs_f64());
                    }
                },
                Ok(Err(e)) => return Err(format!("Processing error: {}", e).into()),
                Err(e) => return Err(format!("Join error: {}", e).into()),
            }
        }
    }

    let total_elapsed = overall_start.elapsed();
    println!("🎉 All {} user files processed successfully in {:.2}s", 
             total_files, total_elapsed.as_secs_f64());

    Ok(())
}

async fn process_user_file(
    pool: Pool,
    path: std::path::PathBuf,
    batch_size: usize,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let file = File::open(&path)?;
    let reader = BufReader::new(file);
    let user_map: BTreeMap<StableUserId, StableUser> = serde_json::from_reader(reader)?;
    
    let total_users = user_map.len();
    let file_name = path.file_name().unwrap().to_string_lossy();
    println!("📁 Processing {} users from file: {}", total_users, file_name);

    // Get a connection from the pool
    let mut client = pool.get().await?;
    let statements = UserPreparedStatements::new(&client).await
        .map_err(|e| format!("Failed to prepare statements: {}", e))?;

    // Process users in batches with progress tracking
    let mut batch = Vec::with_capacity(batch_size);
    let mut processed = 0;
    let start_time = std::time::Instant::now();
    
    for v in user_map.values() {
        batch.push(v);
        
        if batch.len() >= batch_size {
            insert_user_batch(&mut client, &statements, &batch).await
                .map_err(|e| format!("Failed to insert batch: {}", e))?;
            processed += batch.len();
            batch.clear();
            
            // Progress update for large files
            if processed % (batch_size * 5) == 0 {
                let elapsed = start_time.elapsed();
                let rate = processed as f64 / elapsed.as_secs_f64();
                println!("  📊 Progress: {}/{} users ({:.0} users/sec)", processed, total_users, rate);
            }
        }
    }
    
    // Process remaining users
    if !batch.is_empty() {
        insert_user_batch(&mut client, &statements, &batch).await
            .map_err(|e| format!("Failed to insert final batch: {}", e))?;
        processed += batch.len();
    }

    let total_elapsed = start_time.elapsed();
    let final_rate = processed as f64 / total_elapsed.as_secs_f64();
    println!("✅ Completed {}: {} users in {:.2}s ({:.0} users/sec)", 
             file_name, processed, total_elapsed.as_secs_f64(), final_rate);

    Ok(())
}

pub async fn insert_user_batch(
    db_client: &mut Client,
    statements: &UserPreparedStatements,
    users: &[&StableUser],
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    if users.is_empty() {
        return Ok(());
    }

    // Start a transaction for the entire batch
    let transaction = db_client.transaction().await?;
    
    // Pre-process the batch to handle duplicates within the batch itself
    let mut principal_id_map = std::collections::HashSet::new();
    let mut processed_users = Vec::new();
    
    for v in users {
        let mut principal_id = v.principal_id.clone();
        
        // Check if this principal_id already appeared in this batch
        if principal_id_map.contains(&v.principal_id) {
            principal_id = format!("{}_{}", v.principal_id, v.user_id);
            println!("🔄 Batch duplicate detected: user_id={} principal_id modified to {}", 
                     v.user_id, principal_id);
        } else {
            principal_id_map.insert(v.principal_id.clone());
        }
        
        processed_users.push((v, principal_id));
    }
    
    // Process all users in the batch within the transaction
    for (v, principal_id) in processed_users {
        if let Err(e) = insert_user_with_principal_id(v, &principal_id, &transaction, statements).await {
            // On any error, rollback and return immediately
            if let Err(rollback_err) = transaction.rollback().await {
                return Err(format!("Failed to insert user {} ({}), and rollback failed: {}", 
                                  v.user_id, e, rollback_err).into());
            }
            return Err(format!("Failed to insert user {}: {}", v.user_id, e).into());
        }
    }
    
    // Commit the transaction only if all inserts succeeded
    transaction.commit().await?;
    
    println!("✅ Batch of {} users saved successfully", users.len());
    
    Ok(())
}

/// Insert user with pre-determined principal_id (handles cross-batch conflicts)
async fn insert_user_with_principal_id(
    v: &StableUser,
    principal_id: &str,
    transaction: &Transaction<'_>,
    statements: &UserPreparedStatements,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let user_id = v.user_id as i32;
    let referred_by = v.referred_by.map(|x| x as i32);
    let referred_by_expires_at = v.referred_by_expires_at.map(|x| x as f64 / 1_000_000_000.0);
    let fee_level = v.fee_level as i16;
    let fee_level_expires_at = v.fee_level_expires_at.map(|x| x as f64 / 1_000_000_000.0);
    let raw_json = json!({ "StableUser": &v} );

    // Use a savepoint to handle potential constraint violations without aborting the main transaction
    let savepoint_name = format!("sp_user_{}", user_id);
    transaction.execute(&format!("SAVEPOINT {}", savepoint_name), &[]).await?;

    // First attempt with the provided principal_id
    let result = transaction
        .execute(
            &statements.insert_user,
            &[
                &user_id,
                &principal_id,
                &v.my_referral_code,
                &referred_by,
                &referred_by_expires_at,
                &fee_level,
                &fee_level_expires_at,
                &raw_json,
            ],
        )
        .await;

    match result {
        Ok(_) => {
            // Success - release the savepoint
            transaction.execute(&format!("RELEASE SAVEPOINT {}", savepoint_name), &[]).await?;
            
            // Log conflicts for monitoring
            if principal_id != v.principal_id {
                println!("⚠️  user_id={} saved with modified principal_id: {} (original: {})", 
                         v.user_id, principal_id, v.principal_id);
            }
            Ok(())
        }
        Err(e) if e.to_string().contains("duplicate key value violates unique constraint \"users_principal_id_key\"") => {
            // Rollback to savepoint to clear the error state
            transaction.execute(&format!("ROLLBACK TO SAVEPOINT {}", savepoint_name), &[]).await?;
            
            // Handle cross-batch conflict by appending user_id
            let fallback_principal_id = format!("{}_{}", v.principal_id, user_id);
            
            // Try the fallback insert
            let fallback_result = transaction
                .execute(
                    &statements.insert_user,
                    &[
                        &user_id,
                        &fallback_principal_id,
                        &v.my_referral_code,
                        &referred_by,
                        &referred_by_expires_at,
                        &fee_level,
                        &fee_level_expires_at,
                        &raw_json,
                    ],
                )
                .await;
                
            match fallback_result {
                Ok(_) => {
                    // Release the savepoint
                    transaction.execute(&format!("RELEASE SAVEPOINT {}", savepoint_name), &[]).await?;
                    
                    println!("⚠️  user_id={} saved with fallback principal_id: {} (original: {}, first_attempt: {})", 
                             v.user_id, fallback_principal_id, v.principal_id, principal_id);
                    Ok(())
                },
                Err(fallback_err) => {
                    // Rollback to savepoint and release it
                    transaction.execute(&format!("ROLLBACK TO SAVEPOINT {}", savepoint_name), &[]).await?;
                    transaction.execute(&format!("RELEASE SAVEPOINT {}", savepoint_name), &[]).await?;
                    
                    Err(format!("Failed to insert user {} with both original ({}) and fallback ({}) principal_ids. Original error: {}, Fallback error: {}", 
                               v.user_id, principal_id, fallback_principal_id, e, fallback_err).into())
                }
            }
        }
        Err(e) => {
            // Rollback to savepoint and release it for any other error
            transaction.execute(&format!("ROLLBACK TO SAVEPOINT {}", savepoint_name), &[]).await?;
            transaction.execute(&format!("RELEASE SAVEPOINT {}", savepoint_name), &[]).await?;
            Err(e.into())
        }
    }
}

/// Insert user within an existing transaction with duplicate handling
async fn insert_user_in_transaction(
    v: &StableUser,
    transaction: &Transaction<'_>,
    statements: &UserPreparedStatements,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let user_id = v.user_id as i32;
    let referred_by = v.referred_by.map(|x| x as i32);
    let referred_by_expires_at = v.referred_by_expires_at.map(|x| x as f64 / 1_000_000_000.0);
    let fee_level = v.fee_level as i16;
    let fee_level_expires_at = v.fee_level_expires_at.map(|x| x as f64 / 1_000_000_000.0);
    let raw_json = json!({ "StableUser": &v} );

    // Check if this user_id already exists
    let existing_user = transaction
        .query_opt(&statements.check_existing_user, &[&user_id])
        .await?;

    // Determine the principal_id to use, handling conflicts
    let principal_id = if let Some(row) = existing_user {
        let existing_principal: String = row.get(0);
        if existing_principal != v.principal_id {
            // Check if the new principal_id would cause a conflict
            let conflict_check = transaction
                .query_opt(
                    &statements.check_principal_conflict,
                    &[&v.principal_id, &user_id]
                )
                .await?;
            
            if conflict_check.is_some() {
                // There's a conflict - another user has this principal_id
                // Append user_id to make it unique
                format!("{}_{}", v.principal_id, user_id)
            } else {
                v.principal_id.clone()
            }
        } else {
            v.principal_id.clone()
        }
    } else {
        // New user, check if principal_id already exists
        let conflict_check = transaction
            .query_opt(&statements.check_principal_exists, &[&v.principal_id])
            .await?;
        
        if conflict_check.is_some() {
            // Principal ID already exists for another user
            format!("{}_user{}", v.principal_id, user_id)
        } else {
            v.principal_id.clone()
        }
    };

    // Use prepared statement for insert within transaction
    transaction
        .execute(
            &statements.insert_user,
            &[
                &user_id,
                &principal_id,
                &v.my_referral_code,
                &referred_by,
                &referred_by_expires_at,
                &fee_level,
                &fee_level_expires_at,
                &raw_json,
            ],
        )
        .await?;

    // Log conflicts for monitoring
    if principal_id != v.principal_id {
        println!("⚠️  user_id={} saved with modified principal_id: {} (original: {})", 
                 v.user_id, principal_id, v.principal_id);
    }

    Ok(())
}

pub async fn insert_user_on_database_optimized(
    v: &StableUser,
    db_client: &Client,
    statements: &UserPreparedStatements,
) -> Result<(), Box<dyn std::error::Error>> {
    let user_id = v.user_id as i32;
    let referred_by = v.referred_by.map(|x| x as i32);
    let referred_by_expires_at = v.referred_by_expires_at.map(|x| x as f64 / 1_000_000_000.0);
    let fee_level = v.fee_level as i16;
    let fee_level_expires_at = v.fee_level_expires_at.map(|x| x as f64 / 1_000_000_000.0);
    let raw_json = json!({ "StableUser": &v} );

    // Check if this user_id already exists using prepared statement
    let existing_user = db_client
        .query_opt(&statements.check_existing_user, &[&user_id])
        .await?;

    // If user exists and principal_id is different, we need to handle the conflict
    let principal_id = if let Some(row) = existing_user {
        let existing_principal: String = row.get(0);
        if existing_principal != v.principal_id {
            // Check if the new principal_id would cause a conflict
            let conflict_check = db_client
                .query_opt(
                    &statements.check_principal_conflict,
                    &[&v.principal_id, &user_id]
                )
                .await?;
            
            if conflict_check.is_some() {
                // There's a conflict - another user has this principal_id
                // Append user_id to make it unique
                format!("{}_{}", v.principal_id, user_id)
            } else {
                v.principal_id.clone()
            }
        } else {
            v.principal_id.clone()
        }
    } else {
        // New user, check if principal_id already exists
        let conflict_check = db_client
            .query_opt(&statements.check_principal_exists, &[&v.principal_id])
            .await?;
        
        if conflict_check.is_some() {
            // Principal ID already exists for another user
            format!("{}_user{}", v.principal_id, user_id)
        } else {
            v.principal_id.clone()
        }
    };

    // Use prepared statement for insert
    db_client
        .execute(
            &statements.insert_user,
            &[
                &user_id,
                &principal_id,
                &v.my_referral_code,
                &referred_by,
                &referred_by_expires_at,
                &fee_level,
                &fee_level_expires_at,
                &raw_json,
            ],
        )
        .await?;

    // Reduced logging for batch operations - detailed logging only for conflicts
    if principal_id != v.principal_id {
        println!("⚠️  user_id={} saved with modified principal_id: {} (original: {})", v.user_id, principal_id, v.principal_id);
    }
    // Individual success logging removed to avoid spam during batch operations

    Ok(())
}

pub async fn insert_user_on_database(v: &StableUser, db_client: &Client) -> Result<(), Box<dyn std::error::Error>> {
    let user_id = v.user_id as i32;
    let referred_by = v.referred_by.map(|x| x as i32);
    let referred_by_expires_at = v.referred_by_expires_at.map(|x| x as f64 / 1_000_000_000.0);
    let fee_level = v.fee_level as i16;
    let fee_level_expires_at = v.fee_level_expires_at.map(|x| x as f64 / 1_000_000_000.0);
    let raw_json = json!({ "StableUser": &v} );

    // Check if this user_id already exists
    let existing_user = db_client
        .query_opt("SELECT principal_id FROM users WHERE user_id = $1", &[&user_id])
        .await?;

    // If user exists and principal_id is different, we need to handle the conflict
    let principal_id = if let Some(row) = existing_user {
        let existing_principal: String = row.get(0);
        if existing_principal != v.principal_id {
            // Check if the new principal_id would cause a conflict
            let conflict_check = db_client
                .query_opt(
                    "SELECT user_id FROM users WHERE principal_id = $1 AND user_id != $2", 
                    &[&v.principal_id, &user_id]
                )
                .await?;
            
            if conflict_check.is_some() {
                // There's a conflict - another user has this principal_id
                // Append user_id to make it unique
                format!("{}_{}", v.principal_id, user_id)
            } else {
                v.principal_id.clone()
            }
        } else {
            v.principal_id.clone()
        }
    } else {
        // New user, check if principal_id already exists
        let conflict_check = db_client
            .query_opt("SELECT user_id FROM users WHERE principal_id = $1", &[&v.principal_id])
            .await?;
        
        if conflict_check.is_some() {
            // Principal ID already exists for another user
            format!("{}_user{}", v.principal_id, user_id)
        } else {
            v.principal_id.clone()
        }
    };

    db_client
        .execute(
            "INSERT INTO users 
                (user_id, principal_id, my_referral_code, referred_by, referred_by_expires_at, fee_level, fee_level_expires_at, raw_json)
                VALUES ($1, $2, $3, $4, to_timestamp($5), $6, to_timestamp($7), $8)
                ON CONFLICT (user_id) DO UPDATE SET
                    principal_id = $2,
                    my_referral_code = $3,
                    referred_by = $4,
                    referred_by_expires_at = to_timestamp($5),
                    fee_level = $6,
                    fee_level_expires_at = to_timestamp($7),
                    raw_json = $8",
            &[
                &user_id,
                &principal_id,
                &v.my_referral_code,
                &referred_by,
                &referred_by_expires_at,
                &fee_level,
                &fee_level_expires_at,
                &raw_json,
            ],
        )
        .await?;

    // Reduced logging for batch operations - detailed logging only for conflicts
    if principal_id != v.principal_id {
        println!("⚠️  user_id={} saved with modified principal_id: {} (original: {})", v.user_id, principal_id, v.principal_id);
    }
    // Individual success logging removed to avoid spam during batch operations

    Ok(())
}

pub async fn update_users<T: KongUpdate>(kong_update: &T) -> Result<(), Box<dyn std::error::Error>> {
    let dir_path = "./backups";
    let re_pattern = Regex::new(r"^users.*.json$").unwrap();
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
        kong_update.update_users(&contents).await?;
    }

    Ok(())
}
