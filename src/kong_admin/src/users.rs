use kong_lib::stable_user::stable_user::{StableUser, StableUserId};
use kong_lib::user::user_name::to_user_name;
use std::collections::BTreeMap;
use std::fs::File;
use std::io::BufReader;
use tokio_postgres::Client;

pub async fn dump_users(db_client: &Client) -> Result<(), Box<dyn std::error::Error>> {
    let file = File::open("./backups/users.json")?;
    let reader = BufReader::new(file);
    let user_map: BTreeMap<StableUserId, StableUser> = serde_json::from_reader(reader)?;

    for (k, v) in user_map.iter() {
        let user_id = v.user_id as i32;
        let user_name = to_user_name(&v.user_name);
        let referred_by = v.referred_by.map(|x| x as i32);
        let referred_by_expires_at = v.referred_by_expires_at.map(|x| x as f64 / 1_000_000_000.0);
        let fee_level = v.fee_level as i16;
        let fee_level_expires_at = v.fee_level_expires_at.map(|x| x as f64 / 1_000_000_000.0);
        let last_login_ts = v.last_login_ts as f64 / 1_000_000_000.0;
        let last_swap_ts = v.last_swap_ts as f64 / 1_000_000_000.0;
        // insert or update
        db_client
            .execute(
                "INSERT INTO users 
                    (user_id, principal_id, user_name, my_referral_code, referred_by, referred_by_expires_at, fee_level, fee_level_expires_at, campaign1_flags, last_login_ts, last_swap_ts)
                    VALUES ($1, $2, $3, $4, $5, to_timestamp($6), $7, to_timestamp($8), $9, to_timestamp($10), to_timestamp($11))
                    ON CONFLICT (user_id) DO UPDATE SET
                        principal_id = $2,
                        user_name = $3,
                        my_referral_code = $4,
                        referred_by = $5,
                        referred_by_expires_at = to_timestamp($6),
                        fee_level = $7,
                        fee_level_expires_at = to_timestamp($8),
                        campaign1_flags = $9,
                        last_login_ts = to_timestamp($10),
                        last_swap_ts = to_timestamp($11)",
                &[&user_id, &v.principal_id, &user_name, &v.my_referral_code, &referred_by, &referred_by_expires_at, &fee_level, &fee_level_expires_at, &v.campaign1_flags, &last_login_ts, &last_swap_ts],
            )
            .await?;
        println!("user_id={} saved", k.0);
    }

    Ok(())
}
