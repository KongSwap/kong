use crate::settings::read_settings;
use openssl::ssl::{SslConnector, SslMethod};
use postgres_openssl::MakeTlsConnector;
use std::env;
use std::thread;
use std::time::Duration;
use tokio_postgres::Client;

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
        let mut db_client = connect_db(&settings).await?;

        if args.contains(&"--database".to_string()) {
            // Dump to database
            users::update_users_on_database(&db_client).await?;
            tokens_map = tokens::update_tokens_on_database(&db_client).await?;
            pools_map = pools::update_pools_on_database(&db_client, &tokens_map).await?;
            lp_tokens::update_lp_tokens_on_database(&db_client, &tokens_map).await?;
            requests::update_requests_on_database(&db_client).await?;
            claims::update_claims_on_database(&db_client, &tokens_map).await?;
            transfers::update_transfers_on_database(&db_client, &tokens_map).await?;
            txs::update_txs_on_database(&db_client, &tokens_map, &pools_map).await?;
        } else {
            tokens_map = tokens::load_tokens_from_database(&db_client).await?;
            pools_map = pools::load_pools_from_database(&db_client).await?;
        }

        if args.contains(&"--db_updates".to_string()) {
            // read from kong_data and update database
            let identity = create_anonymous_identity();
            let agent = create_agent_from_identity(replica_url, identity, is_mainnet).await?;
            let kong_data = KongData::new(&agent).await;
            let delay_secs = settings.db_updates_delay_secs.unwrap_or(60);
            // loop forever and update database
            let mut last_db_update_id = None;
            loop {
                match get_db_updates(last_db_update_id, &kong_data, &db_client, &mut tokens_map, &mut pools_map).await {
                    Ok(db_update_id) => last_db_update_id = Some(db_update_id),
                    Err(err) => {
                        eprintln!("{}", err);
                        if db_client.is_closed() {
                            db_client = connect_db(&settings).await?;
                        }
                    }
                }

                thread::sleep(Duration::from_secs(delay_secs));
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
