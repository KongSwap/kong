use kong_lib::stable_claim::stable_claim::{StableClaim, StableClaimId};
use num_traits::ToPrimitive;
use serde_json::json;
use std::collections::BTreeMap;
use std::fs::File;
use std::io::BufReader;
use tokio_postgres::Client;

pub async fn dump_claims(db_client: &Client, tokens_map: &BTreeMap<u32, u8>) -> Result<(), Box<dyn std::error::Error>> {
    let file = File::open("./backups/claims.json")?;
    let reader = BufReader::new(file);
    let claim_map: BTreeMap<StableClaimId, StableClaim> = serde_json::from_reader(reader)?;

    for (k, v) in claim_map.iter() {

        /*
        let lp_token_id = v.lp_token_id as i64;
        let user_id = v.user_id as i32;
        let token_id = v.token_id as i32;
        let decimals = tokens_map.get(&v.token_id).ok_or(format!("token_id={} not found", v.token_id))?;
        let amount = v.amount.0.to_f64().unwrap() / 10_u64.pow(*decimals as u32) as f64;
        let ts = v.ts as f64 / 1_000_000_000.0;
        // insert or update
        db_client
            .execute(
                "INSERT INTO lp_token_ledger
                    (lp_token_id, user_id, token_id, amount, ts)
                    VALUES ($1, $2, $3, $4, to_timestamp($5))
                    ON CONFLICT (lp_token_id) DO UPDATE SET
                        user_id = $2,
                        token_id = $3,
                        amount = $4,
                        ts = to_timestamp($5)",
                &[&lp_token_id, &user_id, &token_id, &amount, &ts],
            )
            .await?;
        println!("lp_token_id={} saved", k.0);
        */
    }

    Ok(())
}
