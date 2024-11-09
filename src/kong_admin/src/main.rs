use agent::{create_agent, create_random_identity};
use config::{Config, FileFormat};
use kong_data::KongData;
use serde::Deserialize;
use std::env;
use tokio_postgres::NoTls;

mod agent;
mod claims;
mod kong_data;
mod kong_settings;
mod lp_token_ledger;
mod math_helpers;
mod nat_helpers;
mod pools;
mod requests;
mod tokens;
mod transfers;
mod txs;
mod users;

const LOCAL_REPLICA: &str = "http://localhost:4943";
const MAINNET_REPLICA: &str = "https://ic0.app";

#[derive(Debug, Deserialize)]
struct Database {
    host: String,
    user: String,
    password: String,
    db_name: String,
}

#[derive(Debug, Deserialize)]
struct Settings {
    database: Database,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = env::args().collect::<Vec<String>>();
    let settings = Config::builder()
        .add_source(config::File::with_name("settings.json").format(FileFormat::Json))
        .build()?;
    let config: Settings = settings.try_deserialize()?;
    let db_host = config.database.host;
    let db_user = config.database.user;
    let db_password = config.database.password;
    let db_name = config.database.db_name;
    let mut config = tokio_postgres::Config::new();
    config.host(db_host);
    config.user(db_user);
    config.password(db_password);
    config.dbname(db_name);
    let (db_client, connection) = config.connect(NoTls).await?;

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
    let identity = create_random_identity();
    let agent = create_agent(replica_url, identity, is_mainnet).await?;
    let kong_data = KongData::new(&agent, is_mainnet).await;

    //users::dump_users(&db_client).await?;
    //let tokens_map = tokens::dump_tokens(&db_client).await?;
    //let tokens_map = tokens::load_tokens(&db_client).await?;
    //pools::dump_pools(&db_client, &tokens_map).await?;
    //let pools_map = pools::load_pools(&db_client).await?;
    //lp_token_ledger::dump_lp_token_ledger(&db_client, &tokens_map).await?;
    //requests::dump_requests(&db_client).await?;
    //transfers::dump_transfers(&db_client, &tokens_map).await?;
    //txs::dump_txs(&db_client, &tokens_map, &pools_map).await?;

    kong_settings::archive_kong_settings(&kong_data).await?;
    //users::archive_users(&kong_data).await?;
    //tokens::archive_tokens(&kong_data).await?;
    //pools::archive_pools(&kong_data).await?;
    //lp_token_ledger::archive_lp_token_ledger(&kong_data).await?;
    //requests::archive_requests(&kong_data).await?;
    //transfers::archive_transfers(&kong_data).await?;
    //txs::archive_txs(&kong_data).await?;

    Ok(())
}
