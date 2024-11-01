use tokio_postgres::{Config, NoTls};

mod lp_token_ledger;
mod pools;
mod tokens;
mod users;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut config = Config::new();
    config.host("localhost");
    config.user("kong");
    config.password("kong");
    config.dbname("kong");
    let (client, connection) = config.connect(NoTls).await?;

    tokio::spawn(async move {
        if let Err(e) = connection.await {
            eprintln!("DB connection error: {}", e);
        }
    });

    users::dump_users(&client).await?;
    let tokens_map = tokens::dump_tokens(&client).await?;
    //let tokens_map = tokens::load_tokens(&client).await?;
    pools::dump_pools(&client, &tokens_map).await?;
    lp_token_ledger::dump_lp_token_ledger(&client, &tokens_map).await?;

    Ok(())
}
