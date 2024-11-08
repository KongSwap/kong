use config::{Config, FileFormat};
use serde::Deserialize;
use tokio_postgres::NoTls;

mod claims;
mod lp_token_ledger;
mod math_helpers;
mod pools;
mod requests;
mod tokens;
mod transfers;
mod txs;
mod users;

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
    let (client, connection) = config.connect(NoTls).await?;

    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("DB connection error: {}", e);
        }
    });

    //users::dump_users(&client).await?;
    //let tokens_map = tokens::dump_tokens(&client).await?;
    let tokens_map = tokens::load_tokens(&client).await?;
    //pools::dump_pools(&client, &tokens_map).await?;
    let pools_map = pools::load_pools(&client).await?;
    //lp_token_ledger::dump_lp_token_ledger(&client, &tokens_map).await?;
    requests::dump_requests(&client).await?;
    //transfers::dump_transfers(&client, &tokens_map).await?;
    txs::dump_txs(&client, &tokens_map, &pools_map).await?;

    Ok(())
}
