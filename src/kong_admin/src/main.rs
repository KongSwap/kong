use tokio_postgres::{Config, NoTls};

mod claims;
mod lp_token_ledger;
mod math_helpers;
mod pools;
mod requests;
mod tokens;
mod transfers;
mod txs;
mod users;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut config = Config::new();
    //config.host("localhost");
    config.host("100.115.8.145");
    config.user("kong");
    config.password("IamKong");
    config.dbname("kong");
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
    //requests::dump_requests(&client, &tokens_map).await?;
    //transfers::dump_transfers(&client, &tokens_map).await?;
    txs::dump_txs(&client, &tokens_map, &pools_map).await?;

    Ok(())
}
