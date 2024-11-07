use kong_lib::stable_transfer::stable_transfer::{StableTransfer, StableTransferId};
use kong_lib::stable_transfer::tx_id::TxId;
use num_traits::ToPrimitive;
use serde_json::json;
use std::collections::BTreeMap;
use std::fs::File;
use std::io::BufReader;
use tokio_postgres::Client;

use super::math_helpers::round_f64;

pub async fn dump_transfers(db_client: &Client, tokens_map: &BTreeMap<u32, u8>) -> Result<(), Box<dyn std::error::Error>> {
    let file = File::open("./backups/transfers.44000.json")?;
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
        let raw_json = json!(&v);

        // insert or update
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

    Ok(())
}
