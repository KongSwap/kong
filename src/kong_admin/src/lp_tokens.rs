use kong_lib::stable_lp_token::stable_lp_token::{StableLPToken, StableLPTokenId};
use num_traits::ToPrimitive;
use serde_json::json;
use std::collections::BTreeMap;
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;
use tokio_postgres::Client;

use super::kong_update::KongUpdate;
use super::math_helpers::round_f64;

pub fn serialize_lp_tokens(lp_token: &StableLPToken) -> serde_json::Value {
    json!({
        "lp_token_id": lp_token.lp_token_id,
        "user_id": lp_token.user_id,
        "token_id": lp_token.token_id,
        "amount": lp_token.amount.to_string(),
        "ts": lp_token.ts,
    })
}

pub async fn dump_lp_tokens(db_client: &Client, tokens_map: &BTreeMap<u32, u8>) -> Result<(), Box<dyn std::error::Error>> {
    let file = File::open("./backups/lp_tokens.json")?;
    let reader = BufReader::new(file);
    let lp_token_ledger_map: BTreeMap<StableLPTokenId, StableLPToken> = serde_json::from_reader(reader)?;

    for (k, v) in lp_token_ledger_map.iter() {
        let lp_token_id = v.lp_token_id as i64;
        let user_id = v.user_id as i32;
        let token_id = v.token_id as i32;
        let decimals = tokens_map.get(&v.token_id).ok_or(format!("token_id={} not found", v.token_id))?;
        let amount = round_f64(v.amount.0.to_f64().unwrap() / 10_u64.pow(*decimals as u32) as f64, *decimals);
        let ts = v.ts as f64 / 1_000_000_000.0;
        let raw_json = serialize_lp_tokens(v);

        db_client
            .execute(
                "INSERT INTO lp_tokens 
                    (lp_token_id, user_id, token_id, amount, ts, raw_json)
                    VALUES ($1, $2, $3, $4, to_timestamp($5), $6)
                    ON CONFLICT (lp_token_id) DO UPDATE SET
                        user_id = $2,
                        token_id = $3,
                        amount = $4,
                        ts = to_timestamp($5),
                        raw_json = $6",
                &[&lp_token_id, &user_id, &token_id, &amount, &ts, &raw_json],
            )
            .await?;
        println!("lp_token_id={} saved", k.0);
    }

    Ok(())
}

pub async fn update_lp_tokens<T: KongUpdate>(kong_update: &T) -> Result<(), Box<dyn std::error::Error>> {
    let path = Path::new("./backups/lp_tokens.json");
    let file = File::open(path)?;
    println!("processing: {:?}", path.file_name().unwrap());
    let mut reader = BufReader::new(file);
    let mut contents = String::new();
    reader.read_to_string(&mut contents)?;
    kong_update.update_lp_tokens(&contents).await?;

    Ok(())
}