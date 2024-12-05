use kong_lib::stable_transfer::stable_transfer::{StableTransfer, StableTransferId};
use kong_lib::stable_transfer::tx_id::TxId;
use num_traits::ToPrimitive;
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

pub fn serialize_option_tx_id(tx_id: Option<&TxId>) -> serde_json::Value {
    match tx_id {
        Some(tx_id) => match tx_id {
            TxId::BlockIndex(block_index) => json!(block_index.to_string()),
            TxId::TransactionHash(tx_hash) => json!(tx_hash),
        },
        None => json!("None"),
    }
}

pub fn serialize_tx_id(tx_id: &TxId) -> serde_json::Value {
    match tx_id {
        TxId::BlockIndex(block_index) => json!(block_index.to_string()),
        TxId::TransactionHash(tx_hash) => json!(tx_hash),
    }
}

pub fn serialize_transfer(transfer: &StableTransfer) -> serde_json::Value {
    json!({
        "StableTransfer": {
            "transfer_id": transfer.transfer_id,
            "request_id": transfer.request_id,
            "is_send": transfer.is_send,
            "amount": transfer.amount.to_string(),
            "token_id": transfer.token_id,
            "tx_id": serialize_tx_id(&transfer.tx_id),
            "ts": transfer.ts,
        }
    })
}

pub async fn dump_transfers(db_client: &Client, tokens_map: &BTreeMap<u32, u8>) -> Result<(), Box<dyn std::error::Error>> {
    let dir_path = "./backups";
    let re_pattern = Regex::new(r"transfers.*.json").unwrap();
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
        let transfer_map: BTreeMap<StableTransferId, StableTransfer> = serde_json::from_reader(reader)?;

        for (k, v) in transfer_map.iter() {
            let transfer_id = v.transfer_id as i64;
            let request_id = v.request_id as i64;
            let is_send = v.is_send;
            let token_id = v.token_id as i32;
            let decimals = tokens_map.get(&v.token_id).ok_or(format!("token_id={} not found", v.token_id))?;
            let amount = round_f64(v.amount.0.to_f64().unwrap() / 10_u64.pow(*decimals as u32) as f64, *decimals);
            let (block_index, tx_hash) = match &v.tx_id {
                TxId::BlockIndex(block_index) => (Some(block_index.0.to_f64().unwrap()), None),
                TxId::TransactionHash(tx_hash) => (None, Some(tx_hash)),
            };
            let ts = v.ts as f64 / 1_000_000_000.0;
            let raw_json = serialize_transfer(v);

            db_client
                .execute(
                    "INSERT INTO transfers
                        (transfer_id, request_id, is_send, token_id, amount, block_index, tx_hash, ts, raw_json)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8), $9)
                        ON CONFLICT (transfer_id) DO UPDATE SET
                            request_id = $2,
                            is_send = $3,
                            token_id = $4,
                            amount = $5,
                            block_index = $6,
                            tx_hash = $7,
                            ts = to_timestamp($8),
                            raw_json = $9",
                    &[
                        &transfer_id,
                        &request_id,
                        &is_send,
                        &token_id,
                        &amount,
                        &block_index,
                        &tx_hash,
                        &ts,
                        &raw_json,
                    ],
                )
                .await?;
            println!("transfer_id={} saved", k.0);
        }
    }

    Ok(())
}

pub async fn update_transfers<T: KongUpdate>(kong_data: &T) -> Result<(), Box<dyn std::error::Error>> {
    let dir_path = "./backups";
    let re_pattern = Regex::new(r"transfers.*.json").unwrap();
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
        kong_data.update_transfers(&contents).await?;
    }

    Ok(())
}
