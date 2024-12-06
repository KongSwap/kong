use kong_lib::stable_user::stable_user::{StableUser, StableUserId};
use kong_lib::user::user_name::to_user_name;
use regex::Regex;
use serde_json::json;
use std::collections::BTreeMap;
use std::fs;
use std::fs::File;
use std::io::{BufReader, Read};
use std::path::Path;
use tokio_postgres::Client;

use super::kong_update::KongUpdate;

pub async fn update_users_on_database(db_client: &Client) -> Result<(), Box<dyn std::error::Error>> {
    let dir_path = "./backups";
    let re_pattern = Regex::new(r"users.*.json").unwrap();
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
        let user_map: BTreeMap<StableUserId, StableUser> = serde_json::from_reader(reader)?;

        for v in user_map.values() {
            insert_user_on_database(v, db_client).await?;
        }
    }

    Ok(())
}

pub async fn insert_user_on_database(v: &StableUser, db_client: &Client) -> Result<(), Box<dyn std::error::Error>> {
    let user_id = v.user_id as i32;
    let user_name = to_user_name(&v.user_name);
    let referred_by = v.referred_by.map(|x| x as i32);
    let referred_by_expires_at = v.referred_by_expires_at.map(|x| x as f64 / 1_000_000_000.0);
    let fee_level = v.fee_level as i16;
    let fee_level_expires_at = v.fee_level_expires_at.map(|x| x as f64 / 1_000_000_000.0);
    let campaign1_flags = v.campaign1_flags.clone();
    let last_login_ts = v.last_login_ts as f64 / 1_000_000_000.0;
    let last_swap_ts = v.last_swap_ts as f64 / 1_000_000_000.0;
    let raw_json = json!({ "StableUser": &v} );

    db_client
        .execute(
            "INSERT INTO users 
                (user_id, principal_id, user_name, my_referral_code, referred_by, referred_by_expires_at, fee_level, fee_level_expires_at, campaign1_flags, last_login_ts, last_swap_ts, raw_json)
                VALUES ($1, $2, $3, $4, $5, to_timestamp($6), $7, to_timestamp($8), $9, to_timestamp($10), to_timestamp($11), $12)
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
                    last_swap_ts = to_timestamp($11),
                    raw_json = $12",
            &[&user_id, &v.principal_id, &user_name, &v.my_referral_code, &referred_by, &referred_by_expires_at, &fee_level, &fee_level_expires_at, &campaign1_flags, &last_login_ts, &last_swap_ts, &raw_json],                )
        .await?;

    println!("user_id={} saved", v.user_id);

    Ok(())
}

pub async fn update_users_on_kong_data<T: KongUpdate>(kong_update: &T) -> Result<(), Box<dyn std::error::Error>> {
    let dir_path = "./backups";
    let re_pattern = Regex::new(r"users.*.json").unwrap();
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
        kong_update.update_users(&contents).await?;
    }

    Ok(())
}
