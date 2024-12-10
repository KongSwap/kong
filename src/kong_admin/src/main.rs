use agent::{create_agent, create_identity_from_pem_file};
use kong_backend::KongBackend;
use kong_data::KongData;
use std::env;
use tokio_postgres::NoTls;
use updates::get_db_updates;

use crate::settings::read_settings;

mod agent;
mod claims;
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
mod updates;
mod users;

const LOCAL_REPLICA: &str = "http://localhost:4943";
const MAINNET_REPLICA: &str = "https://ic0.app";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = env::args().collect::<Vec<String>>();
    let config = read_settings()?;
    let dfx_pem_file = &config.dfx_pem_file;
    let db_host = &config.database.host;
    let db_user = &config.database.user;
    let db_password = &config.database.password;
    let db_name = &config.database.db_name;
    let mut db_config = tokio_postgres::Config::new();
    db_config.host(db_host);
    db_config.user(db_user);
    db_config.password(db_password);
    db_config.dbname(db_name);
    let (db_client, connection) = db_config.connect(NoTls).await?;

    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("DB connection error: {}", e);
        }
    });

    let (replica_url, is_mainnet) = if args.contains(&"--mainnet".to_string()) {
        (MAINNET_REPLICA, true)
    } else {
        (LOCAL_REPLICA, false)
    };
    let identity = create_identity_from_pem_file(dfx_pem_file);
    let agent = create_agent(replica_url, identity, is_mainnet).await?;
    let kong_data = KongData::new(&agent, is_mainnet).await;

    let tokens_map = tokens::load_tokens_from_database(&db_client).await?;
    let pools_map = pools::load_pools_from_database(&db_client).await?;

    if args.contains(&"--updates".to_string()) {
        get_db_updates(None, &kong_data, &db_client, &tokens_map, &pools_map).await?;
    } else if args.contains(&"--backup".to_string()) {
        // Dump to database
        // users::update_users_on_database(&db_client).await?;
        // let tokens_map = tokens::update_tokens_on_database(&db_client).await?;
        // let pools_map = pools::update_pools_on_database(&db_client, &tokens_map).await?;
        // lp_tokens::update_lp_tokens_on_database(&db_client, &tokens_map).await?;
        // requests::update_requests_on_database(&db_client).await?;
        // claims::update_claims_on_database(&db_client, &tokens_map).await?;
        transfers::update_transfers_on_database(&db_client, &tokens_map).await?;
        txs::update_txs_on_database(&db_client, &tokens_map, &pools_map).await?;

        // Dump to kong_data
        //kong_settings::update_kong_settings(&kong_data).await?;
        users::update_users_on_kong_data(&kong_data).await?;
        tokens::update_tokens_on_kong_data(&kong_data).await?;
        pools::update_pools_on_kong_data(&kong_data).await?;
        lp_tokens::update_lp_tokens_on_kong_data(&kong_data).await?;
        requests::update_requests_on_kong_data(&kong_data).await?;
        claims::update_claims_on_kong_data(&kong_data).await?;
        transfers::update_transfers_on_kong_data(&kong_data).await?;
        txs::update_txs_on_kong_data(&kong_data).await?;

        // Dump to kong_backend
        // let kong_backend = KongBackend::new(&agent).await;
        // kong_settings::update_kong_settings(&kong_backend).await?;
        // users::update_users(&kong_backend).await?;
        // tokens::update_tokens(&kong_backend).await?;
        // pools::update_pools(&kong_backend).await?;
        // lp_tokens::update_lp_tokens(&kong_backend).await?;
        // requests::update_requests(&kong_backend).await?;
        // claims::update_claims(&kong_backend).await?;
        // transfers::update_transfers(&kong_backend).await?;
        // txs::update_txs(&kong_backend).await?;
    }

    Ok(())
}
