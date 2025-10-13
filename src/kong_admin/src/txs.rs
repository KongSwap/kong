use kong_lib::stable_tx::stable_tx::{StableTx, StableTxId};
use kong_lib::stable_tx::status_tx::StatusTx;
use kong_lib::stable_tx::tx::Tx;
use num_traits::ToPrimitive;
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
use super::math_helpers::round_f64;

#[derive(Debug, ToSql, FromSql)]
#[postgres(name = "tx_type")]
enum TxType {
    #[postgres(name = "add_pool")]
    AddPool,
    #[postgres(name = "add_liquidity")]
    AddLiquidity,
    #[postgres(name = "remove_liquidity")]
    RemoveLiquidity,
    #[postgres(name = "swap")]
    Swap,
    #[postgres(name = "send")]
    Send,
}

#[derive(Debug, ToSql, FromSql)]
#[postgres(name = "tx_status")]
enum TxStatus {
    #[postgres(name = "Success")]
    Success,
    #[postgres(name = "Failed")]
    Failed,
}

pub fn serialize_tx(tx: &StableTx) -> serde_json::Value {
    match tx {
        StableTx::AddPool(tx) => json!({
            "AddPoolTx": {
                "tx_id": tx.tx_id,
                "pool_id": tx.pool_id,
                "request_id": tx.request_id,
                "user_id": tx.user_id,
                "status": tx.status,
                "amount_0": tx.amount_0.to_string(),
                "amount_1": tx.amount_1.to_string(),
                "add_lp_token_amount": tx.add_lp_token_amount.to_string(),
                "transfer_ids": tx.transfer_ids,
                "claim_ids": tx.claim_ids,
                "is_removed": tx.is_removed,
                "ts": tx.ts,
            }
        }),
        StableTx::AddLiquidity(tx) => json!({
            "AddLiquidityTx": {
                "tx_id": tx.tx_id,
                "pool_id": tx.pool_id,
                "request_id": tx.request_id,
                "user_id": tx.user_id,
                "status": tx.status,
                "amount_0": tx.amount_0.to_string(),
                "amount_1": tx.amount_1.to_string(),
                "add_lp_token_amount": tx.add_lp_token_amount.to_string(),
                "transfer_ids": tx.transfer_ids,
                "claim_ids": tx.claim_ids,
                "ts": tx.ts,
            }
        }),
        StableTx::RemoveLiquidity(tx) => json!({
            "RemoveLiquidityTx": {
                "tx_id": tx.tx_id,
                "pool_id": tx.pool_id,
                "request_id": tx.request_id,
                "user_id": tx.user_id,
                "status": tx.status,
                "amount_0": tx.amount_0.to_string(),
                "lp_fee_0": tx.lp_fee_0.to_string(),
                "amount_1": tx.amount_1.to_string(),
                "lp_fee_1": tx.lp_fee_1.to_string(),
                "remove_lp_token_amount": tx.remove_lp_token_amount.to_string(),
                "transfer_ids": tx.transfer_ids,
                "claim_ids": tx.claim_ids,
                "ts": tx.ts,
            }
        }),
        StableTx::Swap(tx) => json!({
            "SwapTx": {
                "tx_id": tx.tx_id,
                "request_id": tx.request_id,
                "user_id": tx.user_id,
                "status": tx.status,
                "pay_token_id": tx.pay_token_id,
                "pay_amount": tx.pay_amount.to_string(),
                "receive_token_id": tx.receive_token_id,
                "receive_amount": tx.receive_amount.to_string(),
                "price": tx.price,
                "mid_price": tx.mid_price,
                "slippage": tx.slippage,
                "txs": tx.txs.iter().map(|x| json!({
                    "pay_token_id": x.pay_token_id,
                    "pay_amount": x.pay_amount.to_string(),
                    "receive_token_id": x.receive_token_id,
                    "receive_amount": x.receive_amount.to_string(),
                    "lp_fee": x.lp_fee.to_string(),
                    "gas_fee": x.gas_fee.to_string(),
                })).collect::<Vec<serde_json::Value>>(),
                "transfer_ids": tx.transfer_ids,
                "claim_ids": tx.claim_ids,
                "ts": tx.ts,
            }
        }),
        StableTx::Send(tx) => json!({
            "SendTx": {
                "tx_id": tx.tx_id,
                "token_id": tx.token_id,
                "request_id": tx.request_id,
                "user_id": tx.user_id,
                "status": tx.status,
                "amount": tx.amount,
                "to_user_id": tx.to_user_id,
                "ts": tx.ts,
            }
        }),
    }
}

pub async fn update_txs_on_database(
    db_client: &Client,
    tokens_map: &BTreeMap<u32, u8>,
    pools_map: &BTreeMap<u32, (u32, u32)>,
) -> Result<(), Box<dyn std::error::Error>> {
    let dir_path = "./backups";
    let re_pattern = Regex::new(r"^txs.*.json$").unwrap();
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
        let txs_map: BTreeMap<StableTxId, StableTx> = serde_json::from_reader(reader)?;

        for (_, v) in txs_map.iter() {
            insert_tx_on_database(v, db_client, tokens_map, pools_map)
                .await
                .unwrap_or_else(|e| eprintln!("{}", e));
        }
    }

    Ok(())
}

pub async fn insert_tx_on_database(
    v: &StableTx,
    db_client: &Client,
    tokens_map: &BTreeMap<u32, u8>,
    pools_map: &BTreeMap<u32, (u32, u32)>,
) -> Result<(), Box<dyn std::error::Error>> {
    let raw_json = serialize_tx(v);
    match v {
        StableTx::AddPool(v) => {
            let tx_id = v.tx_id as i64;
            let pool_id = v.pool_id as i32;
            let request_id = v.request_id as i64;
            let user_id = v.user_id as i32;
            let tx_type = TxType::AddPool;
            let status = match v.status {
                StatusTx::Success => TxStatus::Success,
                StatusTx::Failed => TxStatus::Failed,
            };
            let (token_id_0, token_id_1) = pools_map
                .get(&v.pool_id)
                .ok_or(format!("pool_id={} not found", v.pool_id))?;
            let decimals_0 = tokens_map
                .get(&token_id_0)
                .ok_or(format!("token_id={} not found", token_id_0))?;
            let amount_0 = round_f64(v.amount_0.0.to_f64().unwrap() / 10_u64.pow(*decimals_0 as u32) as f64, *decimals_0);
            let decimals_1 = tokens_map
                .get(&token_id_1)
                .ok_or(format!("token_id={} not found", token_id_1))?;
            let amount_1 = round_f64(v.amount_1.0.to_f64().unwrap() / 10_u64.pow(*decimals_1 as u32) as f64, *decimals_1);
            let add_lp_token_amount = round_f64(v.add_lp_token_amount.0.to_f64().unwrap() / 10_u64.pow(8_u32) as f64, 8_u8);
            let transfer_ids = v.transfer_ids.iter().map(|x| *x as i64).collect::<Vec<i64>>();
            let claims_ids = v.claim_ids.iter().map(|x| *x as i64).collect::<Vec<i64>>();
            let is_removed = v.is_removed;
            let ts = v.ts as f64 / 1_000_000_000.0;

            db_client
                .execute(
                    "INSERT INTO txs
                        (tx_id, request_id, user_id, tx_type, status, ts, raw_json)
                        VALUES ($1, $2, $3, $4, $5, to_timestamp($6), $7)
                        ON CONFLICT (tx_id) DO UPDATE SET
                            request_id = $2,
                            user_id = $3,
                            tx_type = $4,
                            status = $5,
                            ts = to_timestamp($6),
                            raw_json = $7",
                    &[&tx_id, &request_id, &user_id, &tx_type, &status, &ts, &raw_json],
                )
                .await?;

            db_client
                .execute(
                    "INSERT INTO add_pool_tx
                        (tx_id, pool_id, request_id, user_id, status, amount_0, amount_1, add_lp_token_amount, transfer_ids, claim_ids, is_removed, ts)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, to_timestamp($12))
                        ON CONFLICT (tx_id) DO UPDATE SET
                            pool_id = $2,
                            request_id = $3,
                            user_id = $4,
                            status = $5,
                            amount_0 = $6,
                            amount_1 = $7,
                            add_lp_token_amount = $8,
                            transfer_ids = $9,
                            claim_ids = $10,
                            is_removed = $11,
                            ts = to_timestamp($12)",
                    &[&tx_id, &pool_id, &request_id, &user_id, &status, &amount_0, &amount_1, &add_lp_token_amount, &transfer_ids, &claims_ids, &is_removed, &ts],
                )
                .await?;
        }
        StableTx::AddLiquidity(v) => {
            let tx_id = v.tx_id as i64;
            let pool_id = v.pool_id as i32;
            let request_id = v.request_id as i64;
            let user_id = v.user_id as i32;
            let tx_type = TxType::AddLiquidity;
            let status = match v.status {
                StatusTx::Success => TxStatus::Success,
                StatusTx::Failed => TxStatus::Failed,
            };
            let (token_id_0, token_id_1) = pools_map
                .get(&v.pool_id)
                .ok_or(format!("pool_id={} not found", v.pool_id))?;
            let decimals_0 = tokens_map
                .get(&token_id_0)
                .ok_or(format!("token_id={} not found", token_id_0))?;
            let amount_0 = round_f64(v.amount_0.0.to_f64().unwrap() / 10_u64.pow(*decimals_0 as u32) as f64, *decimals_0);
            let decimals_1 = tokens_map
                .get(&token_id_1)
                .ok_or(format!("token_id={} not found", token_id_1))?;
            let amount_1 = round_f64(v.amount_1.0.to_f64().unwrap() / 10_u64.pow(*decimals_1 as u32) as f64, *decimals_1);
            let add_lp_token_amount = round_f64(v.add_lp_token_amount.0.to_f64().unwrap() / 10_u64.pow(8_u32) as f64, 8_u8);
            let transfer_ids = v.transfer_ids.iter().map(|x| *x as i64).collect::<Vec<i64>>();
            let claims_ids = v.claim_ids.iter().map(|x| *x as i64).collect::<Vec<i64>>();
            let ts = v.ts as f64 / 1_000_000_000.0;

            db_client
                .execute(
                    "INSERT INTO txs
                        (tx_id, request_id, user_id, tx_type, status, ts, raw_json)
                        VALUES ($1, $2, $3, $4, $5, to_timestamp($6), $7)
                        ON CONFLICT (tx_id) DO UPDATE SET
                            request_id = $2,
                            user_id = $3,
                            tx_type = $4,
                            status = $5,
                            ts = to_timestamp($6),
                            raw_json = $7",
                    &[&tx_id, &request_id, &user_id, &tx_type, &status, &ts, &raw_json],
                )
                .await?;

            db_client
                .execute(
                    "INSERT INTO add_liquidity_tx
                        (tx_id, pool_id, request_id, user_id, status, amount_0, amount_1, add_lp_token_amount, transfer_ids, claim_ids, ts)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, to_timestamp($11))
                        ON CONFLICT (tx_id) DO UPDATE SET
                            pool_id = $2,
                            request_id = $3,
                            user_id = $4,
                            status = $5,
                            amount_0 = $6,
                            amount_1 = $7,
                            add_lp_token_amount = $8,
                            transfer_ids = $9,
                            claim_ids = $10,
                            ts = to_timestamp($11)",
                    &[
                        &tx_id,
                        &pool_id,
                        &request_id,
                        &user_id,
                        &status,
                        &amount_0,
                        &amount_1,
                        &add_lp_token_amount,
                        &transfer_ids,
                        &claims_ids,
                        &ts,
                    ],
                )
                .await?;
        }
        StableTx::RemoveLiquidity(v) => {
            let tx_id = v.tx_id as i64;
            let pool_id = v.pool_id as i32;
            let request_id = v.request_id as i64;
            let user_id = v.user_id as i32;
            let tx_type = TxType::RemoveLiquidity;
            let status = match v.status {
                StatusTx::Success => TxStatus::Success,
                StatusTx::Failed => TxStatus::Failed,
            };
            let (token_id_0, token_id_1) = pools_map
                .get(&v.pool_id)
                .ok_or(format!("pool_id={} not found", v.pool_id))?;
            let decimals_0 = tokens_map
                .get(&token_id_0)
                .ok_or(format!("token_id={} not found", token_id_0))?;
            let amount_0 = round_f64(v.amount_0.0.to_f64().unwrap() / 10_u64.pow(*decimals_0 as u32) as f64, *decimals_0);
            let lp_fee_0 = round_f64(v.lp_fee_0.0.to_f64().unwrap() / 10_u64.pow(*decimals_0 as u32) as f64, *decimals_0);
            let decimals_1 = tokens_map
                .get(&token_id_1)
                .ok_or(format!("token_id={} not found", token_id_1))?;
            let amount_1 = round_f64(v.amount_1.0.to_f64().unwrap() / 10_u64.pow(*decimals_1 as u32) as f64, *decimals_1);
            let lp_fee_1 = round_f64(v.lp_fee_1.0.to_f64().unwrap() / 10_u64.pow(*decimals_1 as u32) as f64, *decimals_1);
            let remove_lp_token_amount = round_f64(v.remove_lp_token_amount.0.to_f64().unwrap() / 10_u64.pow(8_u32) as f64, 8_u8);
            let transfer_ids = v.transfer_ids.iter().map(|x| *x as i64).collect::<Vec<i64>>();
            let claims_ids = v.claim_ids.iter().map(|x| *x as i64).collect::<Vec<i64>>();
            let ts = v.ts as f64 / 1_000_000_000.0;

            db_client
                .execute(
                    "INSERT INTO txs
                        (tx_id, request_id, user_id, tx_type, status, ts, raw_json)
                        VALUES ($1, $2, $3, $4, $5, to_timestamp($6), $7)
                        ON CONFLICT (tx_id) DO UPDATE SET
                            request_id = $2,
                            user_id = $3,
                            tx_type = $4,
                            status = $5,
                            ts = to_timestamp($6),
                            raw_json = $7",
                    &[&tx_id, &request_id, &user_id, &tx_type, &status, &ts, &raw_json],
                )
                .await?;

            db_client
                .execute(
                    "INSERT INTO remove_liquidity_tx
                    (tx_id, pool_id, request_id, user_id, status, amount_0, lp_fee_0, amount_1, lp_fee_1, remove_lp_token_amount, transfer_ids, claim_ids, ts)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, to_timestamp($13))
                    ON CONFLICT (tx_id) DO UPDATE SET
                        pool_id = $2,
                        request_id = $3,
                        user_id = $4,
                        status = $5,
                        amount_0 = $6,
                        lp_fee_0 = $7,
                        amount_1 = $8,
                        lp_fee_1 = $9,
                        remove_lp_token_amount = $10,
                        transfer_ids = $11,
                        claim_ids = $12,
                        ts = to_timestamp($13)",
                    &[
                        &tx_id,
                        &pool_id,
                        &request_id,
                        &user_id,
                        &status,
                        &amount_0,
                        &lp_fee_0,
                        &amount_1,
                        &lp_fee_1,
                        &remove_lp_token_amount,
                        &transfer_ids,
                        &claims_ids,
                        &ts,
                    ],
                )
                .await?;
        }
        StableTx::Swap(v) => {
            let tx_id = v.tx_id as i64;
            let request_id = v.request_id as i64;
            let user_id = v.user_id as i32;
            let tx_type = TxType::Swap;
            let status = match v.status {
                StatusTx::Success => TxStatus::Success,
                StatusTx::Failed => TxStatus::Failed,
            };
            let pay_token_id = v.pay_token_id as i32;
            let pay_decimal = tokens_map
                .get(&v.pay_token_id)
                .ok_or(format!("token_id={} not found", v.pay_token_id))?;
            let pay_amount = round_f64(
                v.pay_amount.0.to_f64().unwrap() / 10_u64.pow(*pay_decimal as u32) as f64,
                *pay_decimal,
            );
            let receive_token_id = v.receive_token_id as i32;
            let receive_decimal = tokens_map
                .get(&v.receive_token_id)
                .ok_or(format!("token_id={} not found", v.receive_token_id))?;
            let receive_amount = round_f64(
                v.receive_amount.0.to_f64().unwrap() / 10_u64.pow(*receive_decimal as u32) as f64,
                *receive_decimal,
            );
            let price = v.price;
            let mid_price = v.mid_price;
            let slippage = v.slippage;
            let transfer_ids = v.transfer_ids.iter().map(|x| *x as i64).collect::<Vec<i64>>();
            let claim_ids = v.claim_ids.iter().map(|x| *x as i64).collect::<Vec<i64>>();
            let ts = v.ts as f64 / 1_000_000_000.0;

            db_client
                .execute(
                    "INSERT INTO txs
                        (tx_id, request_id, user_id, tx_type, status, ts, raw_json)
                        VALUES ($1, $2, $3, $4, $5, to_timestamp($6), $7)
                        ON CONFLICT (tx_id) DO UPDATE SET
                            request_id = $2,
                            user_id = $3,
                            tx_type = $4,
                            status = $5,
                            ts = to_timestamp($6),
                            raw_json = $7",
                    &[&tx_id, &request_id, &user_id, &tx_type, &status, &ts, &raw_json],
                )
                .await?;

            db_client
                .execute(
                    "INSERT INTO swap_tx
                    (tx_id, request_id, user_id, status, pay_token_id, pay_amount, receive_token_id, receive_amount, price, mid_price, slippage, transfer_ids, claim_ids, ts)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, to_timestamp($14))
                    ON CONFLICT (tx_id) DO UPDATE SET
                        request_id = $2,
                        user_id = $3,
                        status = $4,
                        pay_token_id = $5,
                        pay_amount = $6,
                        receive_token_id = $7,
                        receive_amount = $8,
                        price = $9,
                        mid_price = $10,
                        slippage = $11,
                        transfer_ids = $12,
                        claim_ids = $13,
                        ts = to_timestamp($14)",
                    &[
                        &tx_id,
                        &request_id,
                        &user_id,
                        &status,
                        &pay_token_id,
                        &pay_amount,
                        &receive_token_id,
                        &receive_amount,
                        &price,
                        &mid_price,
                        &slippage,
                        &transfer_ids,
                        &claim_ids,
                        &ts,
                    ],
                )
                .await?;

            for swap in v.txs.iter() {
                let pool_id = swap.pool_id as i32;
                let pay_token_id = swap.pay_token_id as i32;
                let pay_decimal = tokens_map
                    .get(&swap.pay_token_id)
                    .ok_or(format!("token_id={} not found", &swap.pay_token_id))?;
                let pay_amount = round_f64(
                    swap.pay_amount.0.to_f64().unwrap() / 10_u64.pow(*pay_decimal as u32) as f64,
                    *pay_decimal,
                );
                let receive_token_id = swap.receive_token_id as i32;
                let receive_decimal = tokens_map
                    .get(&swap.receive_token_id)
                    .ok_or(format!("token_id={} not found", &swap.receive_token_id))?;
                let receive_amount = round_f64(
                    swap.receive_amount.0.to_f64().unwrap() / 10_u64.pow(*receive_decimal as u32) as f64,
                    *receive_decimal,
                );
                let lp_fee = round_f64(
                    swap.lp_fee.0.to_f64().unwrap() / 10_u64.pow(*receive_decimal as u32) as f64,
                    *pay_decimal,
                );
                let gas_fee = round_f64(
                    swap.gas_fee.0.to_f64().unwrap() / 10_u64.pow(*receive_decimal as u32) as f64,
                    *pay_decimal,
                );

                db_client
                    .execute(
                        "INSERT INTO swap_pool_tx
                        (tx_id, pool_id, pay_token_id, pay_amount, receive_token_id, receive_amount, lp_fee, gas_fee, ts)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, to_timestamp($9))",
                        &[
                            &tx_id,
                            &pool_id,
                            &pay_token_id,
                            &pay_amount,
                            &receive_token_id,
                            &receive_amount,
                            &lp_fee,
                            &gas_fee,
                            &ts,
                        ],
                    )
                    .await?;
            }
        }
        StableTx::Send(v) => {
            let tx_id = v.tx_id as i64;
            let token_id = v.token_id as i32;
            let request_id = v.request_id as i64;
            let user_id = v.user_id as i32;
            let tx_type = TxType::Send;
            let status = match v.status {
                StatusTx::Success => TxStatus::Success,
                StatusTx::Failed => TxStatus::Failed,
            };
            let decimals = tokens_map.get(&v.token_id).ok_or(format!("token_id={} not found", v.token_id))?;
            let amount = round_f64(v.amount.0.to_f64().unwrap() / 10_u64.pow(*decimals as u32) as f64, *decimals);
            let to_user_id = v.to_user_id as i32;
            let ts = v.ts as f64 / 1_000_000_000.0;

            db_client
                .execute(
                    "INSERT INTO txs
                        (tx_id, request_id, user_id, tx_type, status, ts, raw_json)
                        VALUES ($1, $2, $3, $4, $5, to_timestamp($6), $7)
                        ON CONFLICT (tx_id) DO UPDATE SET
                            request_id = $2,
                            user_id = $3,
                            tx_type = $4,
                            status = $5,
                            ts = to_timestamp($6),
                            raw_json = $7",
                    &[&tx_id, &request_id, &user_id, &tx_type, &status, &ts, &raw_json],
                )
                .await?;

            db_client
                .execute(
                    "INSERT INTO send_tx
                    (tx_id, token_id, request_id, user_id, status, amount, to_user_id, ts)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8))
                    ON CONFLICT (tx_id) DO UPDATE SET
                        token_id = $2,
                        request_id = $3,
                        user_id = $4,
                        status = $5,
                        amount = $6,
                        to_user_id = $7,
                        ts = to_timestamp($8)",
                    &[&tx_id, &token_id, &request_id, &user_id, &status, &amount, &to_user_id, &ts],
                )
                .await?;
        }
    };

    println!("tx_id={} saved", v.tx_id());

    Ok(())
}

pub async fn update_txs<T: KongUpdate>(kong_update: &T) -> Result<(), Box<dyn std::error::Error>> {
    let dir_path = "./backups";
    let re_pattern = Regex::new(r"^txs.*.json$").unwrap();
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
        kong_update.update_txs(&contents).await?;
    }

    Ok(())
}
