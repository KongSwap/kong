use kong_lib::stable_pool::stable_pool::{StablePool, StablePoolId};
use num_traits::ToPrimitive;
use std::collections::BTreeMap;
use std::fs::File;
use std::io::BufReader;
use tokio_postgres::Client;

pub async fn dump_pools(db_client: &Client, tokens_map: &BTreeMap<u32, u8>) -> Result<(), Box<dyn std::error::Error>> {
    let file = File::open("./backup/pools.json")?;
    let reader = BufReader::new(file);
    let pools_map: BTreeMap<StablePoolId, StablePool> = serde_json::from_reader(reader)?;

    for (k, v) in pools_map.iter() {
        let pool_id = v.pool_id as i32;
        // token 0
        let token_id_0 = v.token_id_0 as i32;
        let decimals_0 = tokens_map
            .get(&v.token_id_0)
            .ok_or(format!("token_id={} not found", v.token_id_0))?;
        let balance_0 = v.balance_0.0.to_f64().unwrap() / 10_u64.pow(*decimals_0 as u32) as f64;
        let lp_fee_0 = v.lp_fee_0.0.to_f64().unwrap() / 10_u64.pow(*decimals_0 as u32) as f64;
        let kong_fee_0 = v.kong_fee_0.0.to_f64().unwrap() / 10_u64.pow(*decimals_0 as u32) as f64;
        // token 1
        let token_id_1 = v.token_id_1 as i32;
        let decimals_1 = tokens_map
            .get(&v.token_id_1)
            .ok_or(format!("token_id={} not found", v.token_id_1))?;
        let balance_1 = v.balance_1.0.to_f64().unwrap() / 10_u64.pow(*decimals_1 as u32) as f64;
        let lp_fee_1 = v.lp_fee_1.0.to_f64().unwrap() / 10_u64.pow(*decimals_1 as u32) as f64;
        let kong_fee_1 = v.kong_fee_1.0.to_f64().unwrap() / 10_u64.pow(*decimals_1 as u32) as f64;
        // pool
        let lp_fee_bps = v.lp_fee_bps as i16;
        let kong_fee_bps = v.kong_fee_bps as i16;
        let lp_token_id = v.lp_token_id as i32;
        let on_kong = v.on_kong;
        let rolling_24h_volume = v.rolling_24h_volume.0.to_f64().unwrap() / 100_000_000.0; // in USD
        let rolling_24h_lp_fee = v.rolling_24h_lp_fee.0.to_f64().unwrap() / 100_000_000.0; // in USD
        let rolling_24h_num_swaps = v.rolling_24h_num_swaps.0.to_i32();
        let rolling_24h_apy = v.rolling_24h_apy;
        let total_volume = v.total_volume.0.to_f64().unwrap() / 100_000_000.0; // in USD
        let total_lp_fee = v.total_lp_fee.0.to_f64().unwrap() / 100_000_000.0; // in USD

        // insert or update
        db_client
            .execute(
                "INSERT INTO pools 
                    (pool_id, token_id_0, balance_0, lp_fee_0, kong_fee_0, token_id_1, balance_1, lp_fee_1, kong_fee_1, lp_fee_bps, kong_fee_bps, lp_token_id, on_kong, rolling_24h_volume, rolling_24h_lp_fee, rolling_24h_num_swaps, rolling_24h_apy, total_volume, total_lp_fee)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
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
                        total_lp_fee = $19",
                &[&pool_id, &token_id_0, &balance_0, &lp_fee_0, &kong_fee_0, &token_id_1, &balance_1, &lp_fee_1, &kong_fee_1, &lp_fee_bps, &kong_fee_bps, &lp_token_id, &on_kong, &rolling_24h_volume, &rolling_24h_lp_fee, &rolling_24h_num_swaps, &rolling_24h_apy, &total_volume, &total_lp_fee],
            )
            .await?;
        println!("pool_id={} saved", k.0);
    }

    Ok(())
}
