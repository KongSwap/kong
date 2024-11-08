use kong_lib::stable_request::request::Request;
use kong_lib::stable_request::stable_request::{StableRequest, StableRequestId};
use postgres_types::{FromSql, ToSql};
use regex::Regex;
use serde_json::json;
use std::collections::BTreeMap;
use std::fs;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;
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

pub async fn dump_requests(db_client: &Client) -> Result<(), Box<dyn std::error::Error>> {
    let dir_path = "./backups";
    let re_pattern = Regex::new(r"requests.*.json").unwrap();
    let mut files = fs::read_dir(dir_path)?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            if re_pattern.is_match(entry.file_name().to_str().unwrap()) {
                Some(entry)
            } else {
                None
            }
        })
        .map(|entry| {
            // sort by the number in the filename
            let file = entry.path();
            let filename = Path::new(&file).file_name().unwrap().to_str().unwrap();
            let number_str = filename.split('.').nth(1).unwrap();
            let number = number_str.parse::<u32>().unwrap();
            (number, file)
        })
        .collect::<Vec<_>>();
    files.sort_by(|a, b| a.0.cmp(&b.0));

    for file in files {
        let file = File::open(file.1)?;
        let reader = BufReader::new(file);
        let request_map: BTreeMap<StableRequestId, StableRequest> = serde_json::from_reader(reader)?;

        for (k, v) in request_map.iter() {
            match &v.request {
                Request::AddPool(_) => {
                    let request_id = v.request_id as i64;
                    let user_id = v.user_id as i32;
                    let request_type = RequestType::AddPool;
                    let request = json!(&v.request);
                    let reply = json!(&v.reply);
                    let statuses = json!(&v.statuses);
                    let ts = v.ts as f64 / 1_000_000_000.0;

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
                Request::AddLiquidity(_) => {
                    let request_id = v.request_id as i64;
                    let user_id = v.user_id as i32;
                    let request_type = RequestType::AddLiquidity;
                    let request = json!(&v.request);
                    let reply = json!(&v.reply);
                    let statuses = json!(&v.statuses);
                    let ts = v.ts as f64 / 1_000_000_000.0;

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
                Request::RemoveLiquidity(_) => {
                    let request_id = v.request_id as i64;
                    let user_id = v.user_id as i32;
                    let request_type = RequestType::RemoveLiquidity;
                    let request = json!(&v.request);
                    let reply = json!(&v.reply);
                    let statuses = json!(&v.statuses);
                    let ts = v.ts as f64 / 1_000_000_000.0;

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
                Request::Swap(_) => {
                    let request_id = v.request_id as i64;
                    let user_id = v.user_id as i32;
                    let request_type = RequestType::Swap;
                    let request = json!(&v.request);
                    let reply = json!(&v.reply);
                    let statuses = json!(&v.statuses);
                    let ts = v.ts as f64 / 1_000_000_000.0;

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
                Request::Claim(_) => {
                    let request_id = v.request_id as i64;
                    let user_id = v.user_id as i32;
                    let request_type = RequestType::Claim;
                    let request = json!(&v.request);
                    let reply = json!(&v.reply);
                    let statuses = json!(&v.statuses);
                    let ts = v.ts as f64 / 1_000_000_000.0;

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
                Request::Send(_) => {
                    let request_id = v.request_id as i64;
                    let user_id = v.user_id as i32;
                    let request_type = RequestType::Send;
                    let request = json!(&v.request);
                    let reply = json!(&v.reply);
                    let statuses = json!(&v.statuses);
                    let ts = v.ts as f64 / 1_000_000_000.0;

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
            }
        }
    }

    Ok(())
}
