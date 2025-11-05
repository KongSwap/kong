use crate::settings::read_settings;
use deadpool_postgres::{Manager, ManagerConfig, Pool, RecyclingMethod, Runtime};
use openssl::ssl::{SslConnector, SslMethod};
use postgres_openssl::MakeTlsConnector;
use std::env;
use std::time::Duration;
use tokio::time::timeout;
use tokio_postgres::Config;
use tracing::{error, info, warn};
use tracing_subscriber::EnvFilter;

use agent::create_agent_from_identity;
use agent::{create_anonymous_identity, create_identity_from_pem_file};
use db_updates::get_db_updates;
use kong_backend::KongBackend;
use kong_data::KongData;
use settings::Settings;

mod agent;
mod claims;
mod db_updates;
mod kong_backend;
mod kong_data;
mod kong_settings;
mod kong_update;
mod lp_tokens;
mod math_helpers;
mod nat_helpers;
mod pools;
mod requests;
mod settings;
mod tokens;
mod transfers;
mod txs;
mod users;

const LOCAL_REPLICA: &str = "http://localhost:8000";
const MAINNET_REPLICA: &str = "https://ic0.app";

async fn load_sync_state(pool: &Pool) -> Result<Option<u64>, Box<dyn std::error::Error>> {
    let client = pool.get().await?;

    // Create sync_state table if it doesn't exist
    client
        .execute(
            "CREATE TABLE IF NOT EXISTS sync_state (
                id INTEGER PRIMARY KEY DEFAULT 1,
                last_db_update_id BIGINT NOT NULL,
                last_updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT single_row CHECK (id = 1)
            )",
            &[],
        )
        .await?;

    // Load current sync state using prepared statement cache
    let stmt = client
        .prepare_cached("SELECT last_db_update_id FROM sync_state WHERE id = 1")
        .await?;
    let row = client.query_opt(&stmt, &[]).await?;

    match row {
        Some(row) => {
            let last_id: i64 = row.get(0);
            info!("Loaded sync state from database: last_db_update_id={}", last_id);
            Ok(Some(last_id as u64))
        }
        None => {
            info!("No previous sync state found in database, starting from beginning");
            Ok(None)
        }
    }
}

async fn save_sync_state(pool: &Pool, last_db_update_id: u64) -> Result<(), Box<dyn std::error::Error>> {
    let client = pool.get().await?;

    // Use prepared statement cache for better performance
    let stmt = client
        .prepare_cached(
            "INSERT INTO sync_state (id, last_db_update_id, last_updated_at)
            VALUES (1, $1, CURRENT_TIMESTAMP)
            ON CONFLICT (id) DO UPDATE SET
                last_db_update_id = $1,
                last_updated_at = CURRENT_TIMESTAMP"
        )
        .await?;

    client.execute(&stmt, &[&(last_db_update_id as i64)]).await?;

    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing with environment filter
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("kong_admin=info"))
        )
        .with_target(false)
        .with_level(true)
        .init();

    let args = env::args().collect::<Vec<String>>();
    let settings = read_settings()?;

    let (replica_url, is_mainnet) = if args.contains(&"--mainnet".to_string()) {
        (MAINNET_REPLICA, true)
    } else {
        (LOCAL_REPLICA, false)
    };

    // read from flat files (./backups) and update kong_data
    if args.contains(&"--kong_data".to_string()) {
        info!("Starting kong_data update");
        let dfx_pem_file = settings.dfx_pem_file.as_ref().ok_or("dfx identity required for Kong Data")?;
        let identity = create_identity_from_pem_file(dfx_pem_file)?;
        let agent = create_agent_from_identity(replica_url, identity, is_mainnet).await?;
        let kong_data = KongData::new(&agent).await;

        // Parallel execution of independent update operations
        info!("Executing parallel updates for kong_data");
        let start = std::time::Instant::now();

        tokio::try_join!(
            tokens::update_tokens(&kong_data),
            users::update_users(&kong_data),
            pools::update_pools(&kong_data),
            lp_tokens::update_lp_tokens(&kong_data),
            requests::update_requests(&kong_data),
            claims::update_claims(&kong_data),
            transfers::update_transfers(&kong_data),
            txs::update_txs(&kong_data),
        )?;

        info!("Kong data updates completed in {:?}", start.elapsed());
    }

    // read from flat files (./backups) and update kong_backend. used for development
    if args.contains(&"--kong_backend".to_string()) {
        info!("Starting kong_backend update");
        let dfx_pem_file = settings.dfx_pem_file.as_ref().ok_or("dfx identity required for Kong Backend")?;
        let identity = create_identity_from_pem_file(dfx_pem_file)?;
        let agent = create_agent_from_identity(replica_url, identity, is_mainnet).await?;
        let kong_backend = KongBackend::new(&agent).await;

        // Parallel execution of independent update operations
        info!("Executing parallel updates for kong_backend");
        let start = std::time::Instant::now();

        tokio::try_join!(
            tokens::update_tokens(&kong_backend),
            users::update_users(&kong_backend),
            pools::update_pools(&kong_backend),
            lp_tokens::update_lp_tokens(&kong_backend),
            requests::update_requests(&kong_backend),
            claims::update_claims(&kong_backend),
            transfers::update_transfers(&kong_backend),
            txs::update_txs(&kong_backend),
        )?;

        info!("Kong backend updates completed in {:?}", start.elapsed());
    }

    // read from flat files (./backups) and update database
    if args.contains(&"--database".to_string()) || args.contains(&"--db_updates".to_string()) {
        let mut tokens_map;
        let mut pools_map;
        let pool = create_pool(&settings).await?;

        if args.contains(&"--database".to_string()) {
            info!("Starting database update");
            let start = std::time::Instant::now();

            // Sequential execution due to dependencies
            let db_client = pool.get().await?;
            tokens_map = tokens::update_tokens_on_database(&db_client).await?;
            users::update_users_on_database(&db_client).await?;
            pools_map = pools::update_pools_on_database(&db_client, &tokens_map).await?;

            // Sequential execution to prevent database deadlocks
            // Parallel execution was causing deadlocks when multiple transactions
            // tried to update the same metrics rows simultaneously
            lp_tokens::update_lp_tokens_on_database(&db_client, &tokens_map).await?;
            requests::update_requests_on_database(&db_client).await?;
            claims::update_claims_on_database(&db_client, &tokens_map).await?;
            transfers::update_transfers_on_database(&db_client, &tokens_map).await?;
            txs::update_txs_on_database(&db_client, &tokens_map, &pools_map).await?;

            info!("Database updates completed in {:?}", start.elapsed());
        } else {
            info!("Loading tokens and pools from database");
            let db_client = pool.get().await?;
            tokens_map = tokens::load_tokens_from_database(&db_client).await?;
            pools_map = pools::load_pools_from_database(&db_client).await?;
        }

        if args.contains(&"--db_updates".to_string()) {
            info!("Starting db_updates loop with delay of {}s", settings.db_updates_delay_secs.unwrap_or(60));

            // read from kong_data and update database
            let identity = create_anonymous_identity();
            let agent = create_agent_from_identity(replica_url, identity, is_mainnet).await?;
            let kong_data = KongData::new(&agent).await;
            let base_delay_secs = settings.db_updates_delay_secs.unwrap_or(2);
            let mut retry_delay_secs = base_delay_secs;
            const MAX_RETRY_DELAY_SECS: u64 = 300; // 5 minutes max
            const OPERATION_TIMEOUT_SECS: u64 = 900; // 15 minutes timeout for each operation
            const SYNC_STATE_SAVE_INTERVAL: u64 = 2; // Save sync state every 10 updates

            // Load last sync point from database, or start from beginning
            let mut last_db_update_id = match load_sync_state(&pool).await {
                Ok(state) => state,
                Err(e) => {
                    warn!("Failed to load sync state from database: {}", e);
                    None
                }
            };

            if let Some(id) = last_db_update_id {
                info!("Resuming from last sync point: db_update_id={}", id);
            } else {
                info!("Starting fresh sync (no previous state found)");
            }

            // Counter for batching sync_state saves
            let mut updates_since_save = 0u64;

            // Get database connection once and reuse it
            let mut client = pool.get().await?;

            // loop forever and update database
            loop {
                tokio::select! {
                    _ = tokio::signal::ctrl_c() => {
                        info!("Shutdown signal received, gracefully stopping db_updates loop");
                        // Final sync state save before exit
                        if let Some(id) = last_db_update_id {
                            if let Err(e) = save_sync_state(&pool, id).await {
                                error!("Failed to save final sync state: {}", e);
                            } else {
                                info!("Final sync state saved: db_update_id={}", id);
                            }
                        }
                        break;
                    }
                    result = timeout(
                        Duration::from_secs(OPERATION_TIMEOUT_SECS),
                        get_db_updates(last_db_update_id, &kong_data, &mut client, &mut tokens_map, &mut pools_map)
                    ) => {
                        match result {
                            Ok(Ok(db_update_id)) => {
                                last_db_update_id = Some(db_update_id);
                                retry_delay_secs = base_delay_secs; // Reset delay on success
                                updates_since_save += 1;

                                // Batch save sync state every N updates to reduce database I/O
                                if updates_since_save >= SYNC_STATE_SAVE_INTERVAL {
                                    if let Err(e) = save_sync_state(&pool, db_update_id).await {
                                        warn!("Failed to save sync state: {}", e);
                                    } else {
                                        info!("Sync state saved: db_update_id={}", db_update_id);
                                    }
                                    updates_since_save = 0;
                                }

                                info!("DB update successful, last_id: {}", db_update_id);
                            }
                            Ok(Err(err)) => {
                                error!("DB update failed: {}", err);
                                retry_delay_secs = (retry_delay_secs * 2).min(MAX_RETRY_DELAY_SECS);
                                warn!("Retrying in {}s (exponential backoff)", retry_delay_secs);
                                // Pool's RecyclingMethod::Fast handles connection health automatically
                            }
                            Err(_) => {
                                error!("DB update timed out after {}s", OPERATION_TIMEOUT_SECS);
                                retry_delay_secs = (retry_delay_secs * 2).min(MAX_RETRY_DELAY_SECS);
                                warn!("Retrying in {}s (exponential backoff)", retry_delay_secs);
                                // Pool's RecyclingMethod::Fast handles connection health automatically
                            }
                        }

                        // Async sleep instead of blocking thread::sleep
                        tokio::time::sleep(Duration::from_secs(1)).await;
                    }
                }
            }
        }
    }

    Ok(())
}

async fn create_pool(settings: &Settings) -> Result<Pool, Box<dyn std::error::Error>> {
    let db_host = &settings.database.host;
    let db_port = &settings.database.port;
    let db_user = &settings.database.user;
    let db_password = &settings.database.password;
    let db_name = &settings.database.db_name;

    // Configure TLS
    let mut builder = SslConnector::builder(SslMethod::tls()).map_err(|e| format!("SSL error: {}", e))?;
    if let Some(ca_cert) = &settings.database.ca_cert {
        builder
            .set_ca_file(ca_cert)
            .map_err(|e| format!("CA file error: {}", e))?;
    }
    let tls = MakeTlsConnector::new(builder.build());

    // Configure PostgreSQL connection
    let mut pg_config = Config::new();
    pg_config.host(db_host);
    pg_config.port(*db_port);
    pg_config.user(db_user);
    pg_config.password(db_password);
    pg_config.dbname(db_name);

    // Configure connection pool
    let mgr_config = ManagerConfig {
        recycling_method: RecyclingMethod::Fast,
    };
    let mgr = Manager::from_config(pg_config, tls, mgr_config);

    let pool = Pool::builder(mgr)
        .max_size(settings.database.max_connections)
        .wait_timeout(Some(Duration::from_secs(settings.database.connection_timeout_secs)))
        .create_timeout(Some(Duration::from_secs(settings.database.connection_timeout_secs)))
        .recycle_timeout(Some(Duration::from_secs(settings.database.connection_timeout_secs)))
        .runtime(Runtime::Tokio1)
        .build()?;

    info!("Database pool created with max_connections: {}", settings.database.max_connections);

    Ok(pool)
}
