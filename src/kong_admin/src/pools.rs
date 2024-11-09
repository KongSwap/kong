use kong_lib::stable_pool::stable_pool::{StablePool, StablePoolId};
use num_traits::ToPrimitive;
use serde_json::json;
use std::collections::BTreeMap;
use std::fs::File;
use std::io::BufReader;
use tokio_postgres::Client;

use super::math_helpers::round_f64;

pub fn serialize_pool(pool: &StablePool) -> serde_json::Value {
    json!({
        "pool_id": pool.pool_id,
        "token_id_0": pool.token_id_0,
        "balance_0": pool.balance_0.to_string(),
        "lp_fee_0": pool.lp_fee_0.to_string(),
        "kong_fee_0": pool.kong_fee_0.to_string(),
        "token_id_1": pool.token_id_1,
        "balance_1": pool.balance_1.to_string(),
        "lp_fee_1": pool.lp_fee_1.to_string(),
        "kong_fee_1": pool.kong_fee_1.to_string(),
        "lp_fee_bps": pool.lp_fee_bps,
        "kong_fee_bps": pool.kong_fee_bps,
        "lp_token_id": pool.lp_token_id,
        "on_kong": pool.on_kong,
        "rolling_24h_volume": pool.rolling_24h_volume.to_string(),
        "rolling_24h_lp_fee": pool.rolling_24h_lp_fee.to_string(),
        "rolling_24h_num_swaps": pool.rolling_24h_num_swaps.to_string(),
        "rolling_24h_apy": pool.rolling_24h_apy,
        "total_volume": pool.total_volume.to_string(),
        "total_lp_fee": pool.total_lp_fee.to_string(),
    })
}

pub async fn dump_pools(db_client: &Client, tokens_map: &BTreeMap<u32, u8>) -> Result<(), Box<dyn std::error::Error>> {
    let file = File::open("./backups/pools.json")?;
    let reader = BufReader::new(file);
    let pools_map: BTreeMap<StablePoolId, StablePool> = serde_json::from_reader(reader)?;

    for (k, v) in pools_map.iter() {
        let pool_id = v.pool_id as i32;
        // token 0
        let token_id_0 = v.token_id_0 as i32;
        let decimals_0 = tokens_map
            .get(&v.token_id_0)
            .ok_or(format!("token_id={} not found", v.token_id_0))?;
        let balance_0 = round_f64(v.balance_0.0.to_f64().unwrap() / 10_u64.pow(*decimals_0 as u32) as f64, *decimals_0);
        let lp_fee_0 = round_f64(v.lp_fee_0.0.to_f64().unwrap() / 10_u64.pow(*decimals_0 as u32) as f64, *decimals_0);
        let kong_fee_0 = round_f64(
            v.kong_fee_0.0.to_f64().unwrap() / 10_u64.pow(*decimals_0 as u32) as f64,
            *decimals_0,
        );
        // token 1
        let token_id_1 = v.token_id_1 as i32;
        let decimals_1 = tokens_map
            .get(&v.token_id_1)
            .ok_or(format!("token_id={} not found", v.token_id_1))?;
        let balance_1 = round_f64(v.balance_1.0.to_f64().unwrap() / 10_u64.pow(*decimals_1 as u32) as f64, *decimals_1);
        let lp_fee_1 = round_f64(v.lp_fee_1.0.to_f64().unwrap() / 10_u64.pow(*decimals_1 as u32) as f64, *decimals_1);
        let kong_fee_1 = round_f64(
            v.kong_fee_1.0.to_f64().unwrap() / 10_u64.pow(*decimals_1 as u32) as f64,
            *decimals_1,
        );
        // pool
        let lp_fee_bps = v.lp_fee_bps as i16;
        let kong_fee_bps = v.kong_fee_bps as i16;
        let lp_token_id = v.lp_token_id as i32;
        let on_kong = v.on_kong;
        let rolling_24h_volume = round_f64(v.rolling_24h_volume.0.to_f64().unwrap() / 1_000_000.0, 6); // in USD
        let rolling_24h_lp_fee = round_f64(v.rolling_24h_lp_fee.0.to_f64().unwrap() / 1_000_000.0, 6); // in USD
        let rolling_24h_num_swaps = v.rolling_24h_num_swaps.0.to_i32();
        let rolling_24h_apy = v.rolling_24h_apy;
        let total_volume = round_f64(v.total_volume.0.to_f64().unwrap() / 1_000_000.0, 6); // in USD
        let total_lp_fee = round_f64(v.total_lp_fee.0.to_f64().unwrap() / 1_000_000.0, 6); // in USD
        let raw_json = serialize_pool(v);

        db_client
            .execute(
                "INSERT INTO pools 
                    (pool_id, token_id_0, balance_0, lp_fee_0, kong_fee_0, token_id_1, balance_1, lp_fee_1, kong_fee_1, lp_fee_bps, kong_fee_bps, lp_token_id, on_kong, rolling_24h_volume, rolling_24h_lp_fee, rolling_24h_num_swaps, rolling_24h_apy, total_volume, total_lp_fee, raw_json)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
                    ON CONFLICT (pool_id) DO UPDATE SET
                        token_id_0 = $2,
                        balance_0 = $3,
                        lp_fee_0 = $4,
                        kong_fee_0 = $5,
                        token_id_1 = $6,
                        balance_1 = $7,
                        lp_fee_1 = $8,
                        kong_fee_1 = $9,
                        lp_fee_bps = $10,
                        kong_fee_bps = $11,
                        lp_token_id = $12,
                        on_kong = $13,
                        rolling_24h_volume = $14,
                        rolling_24h_lp_fee = $15,
                        rolling_24h_num_swaps = $16,
                        rolling_24h_apy = $17,
                        total_volume = $18,
                        total_lp_fee = $19,
                        raw_json = $20",
                &[&pool_id, &token_id_0, &balance_0, &lp_fee_0, &kong_fee_0, &token_id_1, &balance_1, &lp_fee_1, &kong_fee_1, &lp_fee_bps, &kong_fee_bps, &lp_token_id, &on_kong, &rolling_24h_volume, &rolling_24h_lp_fee, &rolling_24h_num_swaps, &rolling_24h_apy, &total_volume, &total_lp_fee, &raw_json],
            )
            .await?;
        println!("pool_id={} saved", k.0);
    }

    Ok(())
}

pub async fn load_pools(db_client: &Client) -> Result<BTreeMap<u32, (u32, u32)>, Box<dyn std::error::Error>> {
    let mut pools_map = BTreeMap::new();
    let rows = db_client.query("SELECT pool_id, token_id_0, token_id_1 FROM pools", &[]).await?;
    for row in rows {
        let pool_id: i32 = row.get(0);
        let token_id_0: i32 = row.get(1);
        let token_id_1: i32 = row.get(2);
        pools_map.insert(pool_id as u32, (token_id_0 as u32, token_id_1 as u32));
    }
    Ok(pools_map)
}
