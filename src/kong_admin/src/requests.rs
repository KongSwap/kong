use kong_lib::stable_request::request::Request;
use kong_lib::stable_request::stable_request::{StableRequest, StableRequestId};
use kong_lib::tokens;
use num_traits::ToPrimitive;
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

pub async fn dump_requests(db_client: &Client, tokens_map: &BTreeMap<u32, u8>) -> Result<(), Box<dyn std::error::Error>> {
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
                    let request_type = match &v.request {
                        Request::AddPool(a) => {
                            /*
                            db_client
                                .execute(
                                    "INSERT INTO add_pool_args
                                        (request_id, token_0, amount_0, block_index_0, tx_hash_0, token_1, amount_1, block_index_1, tx_hash_1, lp_fee_bps, kong_fee_bps, on_kong)
                                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                                        ON CONFLICT (request_id) DO UPDATE SET
                                            token_0 = $2,
                                            amount_0 = $3,
                                            block_index_0 = $4,
                                            tx_hash_0 = $5,
                                            token_1 = $6,
                                            amount_1 = $7,
                                            block_index_1 = $8,
                                            tx_hash_1 = $9,
                                            lp_fee_bps = $10,
                                            kong_fee_bps = $11,
                                            on_kong = $12",
                                    &[&request_id, &a.token_0, &amount_0, &v.request.block_index_0, &v.request.tx_hash_0, &v.request.token_1, &v.request.amount_1, &v.request.block_index_1, &v.request.tx_hash_1, &v.request.lp_fee_bps, &v.request.kong_fee_bps, &v.request.on_kong],
                                )
                                .await?;
                            */
                            RequestType::AddPool
                        }
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
                Request::RemoveLiquidity(_) => {
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
                Request::Swap(_) => {
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
                Request::Claim(_) => {
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
                Request::Send(_) => {
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
            }
        }
    }

    Ok(())
}
