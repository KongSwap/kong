use crate::settings::read_settings;
use openssl::ssl::{SslConnector, SslMethod};
use postgres_openssl::MakeTlsConnector;
use std::env;
use std::time::Duration;
use tokio::time::timeout;
use tokio_postgres::Client;
use tracing::{error, info, warn};

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

const LOCAL_REPLICA: &str = "http://localhost:4943";
const MAINNET_REPLICA: &str = "https://ic0.app";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt()
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
            users::update_users(&kong_data),
            tokens::update_tokens(&kong_data),
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
            users::update_users(&kong_backend),
            tokens::update_tokens(&kong_backend),
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
        let mut db_client = connect_db(&settings).await?;

        if args.contains(&"--database".to_string()) {
            info!("Starting database update");
            let start = std::time::Instant::now();

            // Sequential execution due to dependencies
            users::update_users_on_database(&db_client).await?;
            tokens_map = tokens::update_tokens_on_database(&db_client).await?;
            pools_map = pools::update_pools_on_database(&db_client, &tokens_map).await?;

            // Parallel execution of operations that depend on tokens_map and pools_map
            tokio::try_join!(
                lp_tokens::update_lp_tokens_on_database(&db_client, &tokens_map),
                requests::update_requests_on_database(&db_client),
                claims::update_claims_on_database(&db_client, &tokens_map),
                transfers::update_transfers_on_database(&db_client, &tokens_map),
                txs::update_txs_on_database(&db_client, &tokens_map, &pools_map),
            )?;

            info!("Database updates completed in {:?}", start.elapsed());
        } else {
            info!("Loading tokens and pools from database");
            tokens_map = tokens::load_tokens_from_database(&db_client).await?;
            pools_map = pools::load_pools_from_database(&db_client).await?;
        }

        if args.contains(&"--db_updates".to_string()) {
            info!("Starting db_updates loop with delay of {}s", settings.db_updates_delay_secs.unwrap_or(60));

            // read from kong_data and update database
            let identity = create_anonymous_identity();
            let agent = create_agent_from_identity(replica_url, identity, is_mainnet).await?;
            let kong_data = KongData::new(&agent).await;
            let base_delay_secs = settings.db_updates_delay_secs.unwrap_or(60);
            let mut retry_delay_secs = base_delay_secs;
            const MAX_RETRY_DELAY_SECS: u64 = 300; // 5 minutes max
            const OPERATION_TIMEOUT_SECS: u64 = 30;

            // loop forever and update database
            let mut last_db_update_id = None;
            loop {
                tokio::select! {
                    _ = tokio::signal::ctrl_c() => {
                        info!("Shutdown signal received, gracefully stopping db_updates loop");
                        break;
                    }
                    result = timeout(
                        Duration::from_secs(OPERATION_TIMEOUT_SECS),
                        get_db_updates(last_db_update_id, &kong_data, &db_client, &mut tokens_map, &mut pools_map)
                    ) => {
                        match result {
                            Ok(Ok(db_update_id)) => {
                                last_db_update_id = Some(db_update_id);
                                retry_delay_secs = base_delay_secs; // Reset delay on success
                                info!("DB update successful, last_id: {:?}", db_update_id);
                            }
                            Ok(Err(err)) => {
                                error!("DB update failed: {}", err);
                                retry_delay_secs = (retry_delay_secs * 2).min(MAX_RETRY_DELAY_SECS);
                                warn!("Retrying in {}s (exponential backoff)", retry_delay_secs);

                                if db_client.is_closed() {
                                    info!("Database connection closed, reconnecting...");
                                    match connect_db(&settings).await {
                                        Ok(new_client) => {
                                            db_client = new_client;
                                            info!("Database reconnected successfully");
                                        }
                                        Err(e) => {
                                            error!("Failed to reconnect to database: {}", e);
                                        }
                                    }
                                }
                            }
                            Err(_) => {
                                error!("DB update timed out after {}s", OPERATION_TIMEOUT_SECS);
                                retry_delay_secs = (retry_delay_secs * 2).min(MAX_RETRY_DELAY_SECS);
                                warn!("Retrying in {}s (exponential backoff)", retry_delay_secs);
                            }
                        }

                        // Async sleep instead of blocking thread::sleep
                        tokio::time::sleep(Duration::from_secs(retry_delay_secs)).await;
                    }
                }
            }
        }
    }

    Ok(())
}

async fn connect_db(settings: &Settings) -> Result<Client, Box<dyn std::error::Error>> {
    let db_host = &settings.database.host;
    let db_port = &settings.database.port;
    let db_user = &settings.database.user;
    let db_password = &settings.database.password;
    let mut builder = SslConnector::builder(SslMethod::tls()).map_err(|e| format!("SSL error: {}", e))?;
    if settings.database.ca_cert.is_some() {
        builder
            .set_ca_file(settings.database.ca_cert.as_ref().unwrap())
            .map_err(|e| format!("CA file error: {}", e))?;
    }
    let tls = MakeTlsConnector::new(builder.build());
    let db_name = &settings.database.db_name;
    let mut db_config = tokio_postgres::Config::new();
    db_config.host(db_host);
    db_config.port(*db_port);
    db_config.user(db_user);
    db_config.password(db_password);
    db_config.dbname(db_name);
    let (db_client, connection) = db_config.connect(tls).await?;

    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("{}", e);
        }
    });

    Ok(db_client)
}
