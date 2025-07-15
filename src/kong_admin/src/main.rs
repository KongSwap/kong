use crate::settings::read_settings;
use std::env;
use std::time::Duration;
use tokio::time;

// Canister layer imports
use canister::{
    create_agent_from_identity,
    create_anonymous_identity,
    create_identity_from_pem_file,
    kong_backend::KongBackend,
    kong_data::KongData,
};

// Database layer imports
use database::{
    create_db_pool,
    create_prepared_statements_cache,
};

// Sync layer imports
use sync::get_db_updates_with_cache;

// Domain imports
use domain::{claims, kong_settings, lp_tokens, pools, requests, tokens, transfers, txs, users};

mod settings;
mod canister;
mod database;
mod sync;
mod domain;
mod utils;

const LOCAL_REPLICA: &str = "http://localhost:4943";
const MAINNET_REPLICA: &str = "https://ic0.app";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = env::args().collect::<Vec<String>>();
    let settings = read_settings()?;

    let (replica_url, is_mainnet) = if args.contains(&"--mainnet".to_string()) {
        (MAINNET_REPLICA, true)
    } else {
        (LOCAL_REPLICA, false)
    };

    // read from flat files (./backups) and update kong_data
    if args.contains(&"--kong_data".to_string()) {
        let dfx_pem_file = settings.dfx_pem_file.as_ref().ok_or("dfx identity required for Kong Data")?;
        let identity = create_identity_from_pem_file(dfx_pem_file)?;
        let agent = create_agent_from_identity(replica_url, identity, is_mainnet).await?;
        let kong_data = KongData::new(&agent).await;
        // Dump to kong_data
        //kong_settings::update_kong_settings(&kong_data).await?;
        users::update_users(&kong_data).await?;
        tokens::update_tokens(&kong_data).await?;
        pools::update_pools(&kong_data).await?;
        lp_tokens::update_lp_tokens(&kong_data).await?;
        requests::update_requests(&kong_data).await?;
        claims::update_claims(&kong_data).await?;
        transfers::update_transfers(&kong_data).await?;
        txs::update_txs(&kong_data).await?;
    }

    // read from flat files (./backups) and update kong_backend. used for development
    if args.contains(&"--kong_backend".to_string()) {
        let dfx_pem_file = settings.dfx_pem_file.as_ref().ok_or("dfx identity required for Kong Backend")?;
        let identity = create_identity_from_pem_file(dfx_pem_file)?;
        let agent = create_agent_from_identity(replica_url, identity, is_mainnet).await?;
        let kong_backend = KongBackend::new(&agent).await;
        // Dump to kong_backend
        //kong_settings::update_kong_settings(&kong_backend).await?;
        users::update_users(&kong_backend).await?;
        tokens::update_tokens(&kong_backend).await?;
        pools::update_pools(&kong_backend).await?;
        lp_tokens::update_lp_tokens(&kong_backend).await?;
        requests::update_requests(&kong_backend).await?;
        claims::update_claims(&kong_backend).await?;
        transfers::update_transfers(&kong_backend).await?;
        txs::update_txs(&kong_backend).await?;
    }

    // read from flat files (./backups) and update database
    if args.contains(&"--database".to_string()) || args.contains(&"--db_updates".to_string()) {
        let mut tokens_map;
        let mut pools_map;
        let db_pool = create_db_pool(&settings).await?;

        if args.contains(&"--database".to_string()) {
            // Dump to database
            sync::update_users_on_database_adapter(&db_pool).await?;
            tokens_map = tokens::update_tokens_on_database(&db_pool).await?;
            pools_map = sync::update_pools_on_database_adapter(&db_pool, &tokens_map).await?;
            sync::update_lp_tokens_on_database_adapter(&db_pool, &tokens_map).await?;
            requests::update_requests_on_database(&db_pool).await?;
            sync::update_claims_on_database_adapter(&db_pool, &tokens_map).await?;
            sync::update_transfers_on_database_adapter(&db_pool, &tokens_map).await?;
            sync::update_txs_on_database_adapter(&db_pool, &tokens_map, &pools_map).await?;
        } else {
            tokens_map = tokens::load_tokens_from_database(&db_pool).await?;
            pools_map = sync::load_pools_from_database_adapter(&db_pool).await?;
        }

        if args.contains(&"--db_updates".to_string()) {
            // read from kong_data and update database
            let identity = create_anonymous_identity();
            let agent = create_agent_from_identity(replica_url, identity, is_mainnet).await?;
            let kong_data = KongData::new(&agent).await;
            let delay_secs = settings.db_updates_delay_secs.unwrap_or(60);
            
            // Create prepared statements cache for performance
            let prepared_cache = create_prepared_statements_cache();
            
            // Read the last processed db_update_id from the database
            let mut last_db_update_id = match database::read_last_db_update_id(&db_pool).await {
                Ok(id) => {
                    if let Some(id) = id {
                        println!("Resuming from last_db_update_id: {}", id);
                    } else {
                        println!("Starting fresh - no previous last_db_update_id found");
                    }
                    id
                }
                Err(e) => {
                    eprintln!("Warning: Failed to read last_db_update_id: {}. Starting from beginning.", e);
                    None
                }
            };
            
            // Retry logic configuration
            let mut consecutive_errors = 0;
            const MAX_RETRIES: u32 = 5;
            const BASE_RETRY_DELAY: u64 = 2; // seconds
            
            // loop forever and update database
            loop {
                let previous_id = last_db_update_id;
                match get_db_updates_with_cache(last_db_update_id, &kong_data, &db_pool, &mut tokens_map, &mut pools_map, Some(&prepared_cache)).await {
                    Ok(db_update_id) => {
                        last_db_update_id = Some(db_update_id);
                        consecutive_errors = 0; // Reset error count on success
                        
                        // Only sleep if no new updates were found
                        if previous_id == last_db_update_id {
                            println!("No new updates found. Waiting {} seconds before next check...", delay_secs);
                            time::sleep(Duration::from_secs(delay_secs)).await;
                        } else {
                            // New updates were processed, check again immediately
                            println!("Processed updates. Checking for more immediately...");
                        }
                    }
                    Err(err) => {
                        consecutive_errors += 1;
                        eprintln!("Error processing db_updates (attempt {}/{}): {}", consecutive_errors, MAX_RETRIES, err);
                        
                        // Connection pool handles reconnection automatically
                        // Exponential backoff for retries
                        if consecutive_errors < MAX_RETRIES {
                            let retry_delay = BASE_RETRY_DELAY.pow(consecutive_errors.min(4)) as u64;
                            println!("Retrying in {} seconds...", retry_delay);
                            time::sleep(Duration::from_secs(retry_delay)).await;
                            continue;
                        } else {
                            eprintln!("Max retries reached. Waiting for next regular cycle...");
                            consecutive_errors = 0; // Reset for next cycle
                            time::sleep(Duration::from_secs(delay_secs)).await;
                        }
                    }
                }
            }
        }
    }

    Ok(())
}