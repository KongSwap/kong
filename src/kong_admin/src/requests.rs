use kong_lib::stable_request::reply::Reply;
use kong_lib::stable_request::request::Request;
use kong_lib::stable_request::stable_request::{StableRequest, StableRequestId};
use kong_lib::transfers::transfer_reply::TransferReply;
use postgres_types::{FromSql, ToSql};
use regex::Regex;
use serde_json::json;
use std::collections::BTreeMap;
use std::fs;
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;
use tokio_postgres::Client;

use super::kong_update::KongUpdate;
use super::nat_helpers::nat_option_to_string;
use super::transfers::serialize_option_tx_id;

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

pub fn serialize_request(request: &Request) -> serde_json::Value {
    match &request {
        Request::AddPool(request) => json!({
            "AddPoolArgs": {
                "token_0": request.token_0,
                "amount_0": request.amount_0.to_string(),
                "tx_id_0": serialize_option_tx_id(request.tx_id_0.as_ref()),
                "token_1": request.token_1,
                "amount_1": request.amount_1.to_string(),
                "tx_id_1": serialize_option_tx_id(request.tx_id_1.as_ref()),
                "lp_fee_bps": request.lp_fee_bps,
            }
        }),
        Request::AddLiquidity(request) => json!({
            "AddLiquidtyArgs": {
                "token_0": request.token_0,
                "amount_0": request.amount_0.to_string(),
                "tx_id_0": serialize_option_tx_id(request.tx_id_0.as_ref()),
                "token_1": request.token_1,
                "amount_1": request.amount_1.to_string(),
                "tx_id_1": serialize_option_tx_id(request.tx_id_1.as_ref()),
            }
        }),
        Request::RemoveLiquidity(request) => json!({
            "RemoveLiquidityArgs": {
                "token_0": request.token_0,
                "token_1": request.token_1,
                "remove_lp_token_amount": request.remove_lp_token_amount.to_string(),
            }
        }),
        Request::Swap(request) => json!({
            "SwapArgs": {
                "pay_token": request.pay_token,
                "pay_amount": request.pay_amount.to_string(),
                "pay_tx_id": serialize_option_tx_id(request.pay_tx_id.as_ref()),
                "receive_token": request.receive_token,
                "receive_amount": nat_option_to_string(request.receive_amount.as_ref()),
                "receive_address": request.receive_address,
                "max_slippage": request.max_slippage,
                "referred_by": request.referred_by,
            }
        }),
        Request::Claim(claim_id) => json!({
            "claim_id": claim_id,
        }),
        Request::Send(request) => json!({
            "SendArgs": {
                "token": request.token,
                "amount": request.amount.to_string(),
                "to_address": request.to_address,
            }
        }),
    }
}

pub fn serialize_reply(reply: &Reply) -> serde_json::Value {
    match &reply {
        Reply::Pending => json!("Pending"),
        Reply::AddPool(reply) => json!({
            "AddPoolReply": {
                "tx_id": reply.tx_id,
                "pool_id": reply.pool_id,
                "request_id": reply.request_id,
                "status": reply.status,
                "name": reply.name,
                "symbol": reply.symbol,
                "chain_0": reply.chain_0,
                "address_0": reply.address_0,
                "symbol_0": reply.symbol_0,
                "amount_0": reply.amount_0.to_string(),
                "balance_0": reply.balance_0.to_string(),
                "chain_1": reply.chain_1,
                "address_1": reply.address_1,
                "symbol_1": reply.symbol_1,
                "amount_1": reply.amount_1.to_string(),
                "balance_1": reply.balance_1.to_string(),
                "add_lp_token_amount": reply.add_lp_token_amount.to_string(),
                "lp_fee_bps": reply.lp_fee_bps,
                "lp_token_symbol": reply.lp_token_symbol,
                "transfer_ids": reply.transfer_ids.iter().map(|id| json!({
                    "transfer_id": id.transfer_id,
                    "transfer": match &id.transfer {
                        TransferReply::IC(transfer_reply) => json!({
                            "chain": transfer_reply.chain,
                            "symbol": transfer_reply.symbol,
                            "is_send": transfer_reply.is_send,
                            "amount": transfer_reply.amount.to_string(),
                            "canister_id": transfer_reply.canister_id,
                            "block_index": transfer_reply.block_index.to_string(),
                        }),
                    },
                })).collect::<Vec<_>>(),
                "claim_ids": reply.claim_ids,
                "is_removed": reply.is_removed,
                "ts": reply.ts,
            }
        }),
        Reply::AddLiquidity(reply) => json!({
            "AddLiquidityReply": {
                "tx_id": reply.tx_id,
                "request_id": reply.request_id,
                "status": reply.status,
                "symbol": reply.symbol,
                "chain_0": reply.chain_0,
                "address_0": reply.address_0,
                "symbol_0": reply.symbol_0,
                "amount_0": reply.amount_0.to_string(),
                "chain_1": reply.chain_1,
                "address_1": reply.address_1,
                "symbol_1": reply.symbol_1,
                "amount_1": reply.amount_1.to_string(),
                "add_lp_token_amount": reply.add_lp_token_amount.to_string(),
                "transfer_ids": reply.transfer_ids.iter().map(|id| json!({
                    "transfer_id": id.transfer_id,
                    "transfer": match &id.transfer {
                        TransferReply::IC(transfer_reply) => json!({
                            "chain": transfer_reply.chain,
                            "symbol": transfer_reply.symbol,
                            "is_send": transfer_reply.is_send,
                            "amount": transfer_reply.amount.to_string(),
                            "canister_id": transfer_reply.canister_id,
                            "block_index": transfer_reply.block_index.to_string(),
                        }),
                    },
                })).collect::<Vec<_>>(),
                "claim_ids": reply.claim_ids,
                "ts": reply.ts,
            }
        }),
        Reply::RemoveLiquidity(reply) => json!({
            "RemoveLiquidityReply": {
                "tx_id": reply.tx_id,
                "request_id": reply.request_id,
                "status": reply.status,
                "symbol": reply.symbol,
                "chain_0": reply.chain_0,
                "address_0": reply.address_0,
                "symbol_0": reply.symbol_0,
                "amount_0": reply.amount_0.to_string(),
                "lp_fee_0": reply.lp_fee_0.to_string(),
                "chain_1": reply.chain_1,
                "address_1": reply.address_1,
                "symbol_1": reply.symbol_1,
                "amount_1": reply.amount_1.to_string(),
                "lp_fee_1": reply.lp_fee_1.to_string(),
                "remove_lp_token_amount": reply.remove_lp_token_amount.to_string(),
                "transfer_ids": reply.transfer_ids.iter().map(|id| json!({
                    "transfer_id": id.transfer_id,
                    "transfer": match &id.transfer {
                        TransferReply::IC(transfer_reply) => json!({
                            "chain": transfer_reply.chain,
                            "symbol": transfer_reply.symbol,
                            "is_send": transfer_reply.is_send,
                            "amount": transfer_reply.amount.to_string(),
                            "canister_id": transfer_reply.canister_id,
                            "block_index": transfer_reply.block_index.to_string(),
                        }),
                    },
                })).collect::<Vec<_>>(),
                "claim_ids": reply.claim_ids,
                "ts": reply.ts,
            }
        }),
        Reply::Swap(reply) => json!({
            "SwapReply": {
                "tx_id": reply.tx_id,
                "request_id": reply.request_id,
                "status": reply.status,
                "pay_chain": reply.pay_chain,
                "pay_symbol": reply.pay_symbol,
                "pay_amount": reply.pay_amount.to_string(),
                "receive_chain": reply.receive_chain,
                "receive_symbol": reply.receive_symbol,
                "receive_amount": reply.receive_amount.to_string(),
                "mid_price": reply.mid_price,
                "price": reply.price,
                "slippage": reply.slippage,
                "txs": reply.txs.iter().map(|tx| json!({
                    "pool_symbol": tx.pool_symbol,
                    "pay_chain": tx.pay_chain,
                    "pay_symbol": tx.pay_symbol,
                    "pay_amount": tx.pay_amount.to_string(),
                    "receive_chain": tx.receive_chain,
                    "receive_symbol": tx.receive_symbol,
                    "receive_amount": tx.receive_amount.to_string(),
                    "price": tx.price,
                    "lp_fee": tx.lp_fee.to_string(),
                    "gas_fee": tx.gas_fee.to_string(),
                    "ts": tx.ts,
                })).collect::<Vec<_>>(),
                "transfer_ids": reply.transfer_ids.iter().map(|id| json!({
                    "transfer_id": id.transfer_id,
                    "transfer": match &id.transfer {
                        TransferReply::IC(transfer_reply) => json!({
                            "chain": transfer_reply.chain,
                            "symbol": transfer_reply.symbol,
                            "is_send": transfer_reply.is_send,
                            "amount": transfer_reply.amount.to_string(),
                            "canister_id": transfer_reply.canister_id,
                            "block_index": transfer_reply.block_index.to_string(),
                        }),
                    },
                })).collect::<Vec<_>>(),
                "claim_ids": reply.claim_ids,
                "ts": reply.ts,
            }
        }),
        Reply::Claim(reply) => json!({
            "ClaimReply": {
                "claim_id": reply.claim_id,
                "status": reply.status,
                "chain": reply.chain,
                "symbol": reply.symbol,
                "amount": reply.amount.to_string(),
                "fee": reply.fee.to_string(),
                "to_address": reply.to_address,
                "transfer_ids": reply.transfer_ids.iter().map(|id| json!({
                    "transfer_id": id.transfer_id,
                    "transfer": match &id.transfer {
                        TransferReply::IC(transfer_reply) => json!({
                            "chain": transfer_reply.chain,
                            "symbol": transfer_reply.symbol,
                            "is_send": transfer_reply.is_send,
                            "amount": transfer_reply.amount.to_string(),
                            "canister_id": transfer_reply.canister_id,
                            "block_index": transfer_reply.block_index.to_string(),
                        }),
                    },
                })).collect::<Vec<_>>(),
                "ts": reply.ts,
            }
        }),
        Reply::Send(reply) => json!({
            "SendReply": {
                "tx_id": reply.tx_id,
                "request_id": reply.request_id,
                "status": reply.status,
                "chain": reply.chain,
                "symbol": reply.symbol,
                "amount": reply.amount.to_string(),
                "to_address": reply.to_address,
                "ts": reply.ts,
            }
        }),
    }
}

pub async fn update_requests_on_database(db_client: &Client) -> Result<(), Box<dyn std::error::Error>> {
    let dir_path = "./backups";
    let re_pattern = Regex::new(r"^requests.*.json$").unwrap();
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

        for v in request_map.values() {
            insert_request_on_database(v, db_client).await?;
        }
    }

    Ok(())
}

pub async fn insert_request_on_database(v: &StableRequest, db_client: &Client) -> Result<(), Box<dyn std::error::Error>> {
    match v.request {
        Request::AddPool(_) => {
            let request_id = v.request_id as i64;
            let user_id = v.user_id as i32;
            let request_type = RequestType::AddPool;
            let request = serialize_request(&v.request);
            let reply = serialize_reply(&v.reply);
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
            println!("request_id={} saved", v.request_id);
        }
        Request::AddLiquidity(_) => {
            let request_id = v.request_id as i64;
            let user_id = v.user_id as i32;
            let request_type = RequestType::AddLiquidity;
            let request = serialize_request(&v.request);
            let reply = serialize_reply(&v.reply);
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
            println!("request_id={} saved", v.request_id);
        }
        Request::RemoveLiquidity(_) => {
            let request_id = v.request_id as i64;
            let user_id = v.user_id as i32;
            let request_type = RequestType::RemoveLiquidity;
            let request = serialize_request(&v.request);
            let reply = serialize_reply(&v.reply);
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
            println!("request_id={} saved", v.request_id);
        }
        Request::Swap(_) => {
            let request_id = v.request_id as i64;
            let user_id = v.user_id as i32;
            let request_type = RequestType::Swap;
            let request = serialize_request(&v.request);
            let reply = serialize_reply(&v.reply);
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
            println!("request_id={} saved", v.request_id);
        }
        Request::Claim(_) => {
            let request_id = v.request_id as i64;
            let user_id = v.user_id as i32;
            let request_type = RequestType::Claim;
            let request = serialize_request(&v.request);
            let reply = serialize_reply(&v.reply);
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
            println!("request_id={} saved", v.request_id);
        }
        Request::Send(_) => {
            let request_id = v.request_id as i64;
            let user_id = v.user_id as i32;
            let request_type = RequestType::Send;
            let request = serialize_request(&v.request);
            let reply = serialize_reply(&v.reply);
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
        }
    }

    Ok(())
}

pub async fn update_requests<T: KongUpdate>(kong_update: &T) -> Result<(), Box<dyn std::error::Error>> {
    let dir_path = "./backups";
    let re_pattern = Regex::new(r"^requests.*.json$").unwrap();
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
        println!("processing: {:?}", file.1.file_name().unwrap());
        let file = File::open(file.1)?;
        let mut reader = BufReader::new(file);
        let mut contents = String::new();
        reader.read_to_string(&mut contents)?;
        kong_update.update_requests(&contents).await?;
    }

    Ok(())
}
