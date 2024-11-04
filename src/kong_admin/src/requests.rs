use kong_lib::stable_request::request::Request;
use kong_lib::stable_request::stable_request::{StableRequest, StableRequestId};
use num_traits::ToPrimitive;
use postgres_types::{FromSql, ToSql};
use serde_json::json;
use std::collections::BTreeMap;
use std::fs::File;
use std::io::BufReader;
use tokio_postgres::Client;

#[derive(Debug, ToSql, FromSql)]
#[postgres(name = "request_type")]
enum RequestType {
    #[postgres(name = "add_pool")]
    AddPool,
    #[postgres(name = "add_liquidity")]
    AddLiquidity,
    #[postgres(name = "remove_liquidity")]
    RemoveLiquidity,
    #[postgres(name = "swap")]
    Swap,
    #[postgres(name = "claim")]
    Claim,
    #[postgres(name = "send")]
    Send,
}

pub async fn dump_requests(db_client: &Client, tokens_map: &BTreeMap<u32, u8>) -> Result<(), Box<dyn std::error::Error>> {
    let file = File::open("./backups/requests.json")?;
    let reader = BufReader::new(file);
    let request_map: BTreeMap<StableRequestId, StableRequest> = serde_json::from_reader(reader)?;

    for (k, v) in request_map.iter() {
        let request_id = v.request_id as i64;
        let user_id = v.user_id as i32;
        let request_type = match &v.request {
            Request::AddPool(_) => RequestType::AddPool,
            Request::AddLiquidity(_) => RequestType::AddLiquidity,
            Request::RemoveLiquidity(_) => RequestType::RemoveLiquidity,
            Request::Swap(_) => RequestType::Swap,
            Request::Claim(_) => RequestType::Claim,
            Request::Send(_) => RequestType::Send,
        };
        let request = json!(&v.request);
        let reply = json!(&v.reply);
        let statuses = json!(&v.statuses);
        let ts = v.ts as f64 / 1_000_000_000.0;

        // insert or update
        db_client
            .execute(
                "INSERT INTO requests
                    (request_id, user_id, request_type, request, reply, statuses, ts)
                    VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7))
                    ON CONFLICT (request_id) DO UPDATE SET
                        user_id = $2,
                        request_type = $3,
                        request = $4,
                        reply = $5,
                        statuses = $6,
                        ts = to_timestamp($7)",
                &[&request_id, &user_id, &request_type, &request, &reply, &statuses, &ts],
            )
            .await?;
        println!("request_id={} saved", k.0);
    }

    Ok(())
}
