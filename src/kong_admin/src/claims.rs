use kong_lib::ic::address::Address;
use kong_lib::stable_claim::stable_claim;
use kong_lib::stable_claim::stable_claim::{StableClaim, StableClaimId};
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
#[postgres(name = "claim_status")]
enum ClaimStatus {
    #[postgres(name = "Unclaimed")]
    Unclaimed,
    #[postgres(name = "Claiming")]
    Claiming,
    #[postgres(name = "Claimed")]
    Claimed,
    #[postgres(name = "TooManyAttempts")]
    TooManyAttempts,
    #[postgres(name = "UnclaimedOverride")]
    UnclaimedOverride,
    #[postgres(name = "Claimable")]
    Claimable,
}

pub fn serialize_claim_status(claim_status: &stable_claim::ClaimStatus) -> serde_json::Value {
    match claim_status {
        stable_claim::ClaimStatus::Unclaimed => json!("Unclaimed"),
        stable_claim::ClaimStatus::Claiming => json!("Claiming"),
        stable_claim::ClaimStatus::Claimed => json!("Claimed"),
        stable_claim::ClaimStatus::TooManyAttempts => json!("TooManyAttempts"),
        stable_claim::ClaimStatus::UnclaimedOverride => json!("UnclaimedOverride"),
        stable_claim::ClaimStatus::Claimable => json!("Claimable"),
    }
}

pub fn serialize_option_address(address: Option<&Address>) -> serde_json::Value {
    match address {
        Some(address) => match address {
            Address::AccountId(account_id) => json!(account_id.to_string()),
            Address::PrincipalId(principal_id) => json!(principal_id.to_string()),
        },
        None => json!("None"),
    }
}

pub fn serialize_option_desc(desc: Option<&String>) -> serde_json::Value {
    match desc {
        Some(desc) => json!(desc),
        None => json!("None"),
    }
}

pub fn serialize_claim(claim: &StableClaim) -> serde_json::Value {
    json!({
        "StableClaim": {
            "claim_id": claim.claim_id,
            "user_id": claim.user_id,
            "token_id": claim.token_id,
            "status": serialize_claim_status(&claim.status),
            "amount": claim.amount.to_string(),
            "request_id": claim.request_id,
            "to_address": serialize_option_address(claim.to_address.as_ref()),
            "desc": serialize_option_desc(claim.desc.as_ref()),
            "attempt_request_id": claim.attempt_request_id,
            "transfer_ids": claim.transfer_ids,
            "ts": claim.ts,
        }
    })
}

pub async fn update_claims_on_database(db_client: &Client, tokens_map: &BTreeMap<u32, u8>) -> Result<(), Box<dyn std::error::Error>> {
    let dir_path = "./backups";
    let re_pattern = Regex::new(r"^claims.*.json$").unwrap();
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
        let claim_map: BTreeMap<StableClaimId, StableClaim> = serde_json::from_reader(reader)?;

        for v in claim_map.values() {
            insert_claim_on_database(v, db_client, tokens_map).await?;
        }
    }

    Ok(())
}

pub async fn insert_claim_on_database(
    v: &StableClaim,
    db_client: &Client,
    tokens_map: &BTreeMap<u32, u8>,
) -> Result<(), Box<dyn std::error::Error>> {
    let claim_id = v.claim_id as i64;
    let user_id = v.user_id as i32;
    let token_id = v.token_id as i32;
    let status = match v.status {
        stable_claim::ClaimStatus::Unclaimed => ClaimStatus::Unclaimed,
        stable_claim::ClaimStatus::Claiming => ClaimStatus::Claiming,
        stable_claim::ClaimStatus::Claimed => ClaimStatus::Claimed,
        stable_claim::ClaimStatus::TooManyAttempts => ClaimStatus::TooManyAttempts,
        stable_claim::ClaimStatus::UnclaimedOverride => ClaimStatus::UnclaimedOverride,
        stable_claim::ClaimStatus::Claimable => ClaimStatus::Claimable,
    };
    let decimals = tokens_map.get(&v.token_id).ok_or(format!("token_id={} not found", v.token_id))?;
    let amount = round_f64(v.amount.0.to_f64().unwrap() / 10_u64.pow(*decimals as u32) as f64, *decimals);
    let request_id = v.request_id.map(|x| x as i64);
    let to_address = v.to_address.as_ref().map(|x| x.to_string());
    let desc = v.desc.clone();
    let attempt_request_id = v.attempt_request_id.iter().map(|x| *x as i64).collect::<Vec<_>>();
    let transfer_ids = v.transfer_ids.iter().map(|x| *x as i64).collect::<Vec<_>>();
    let ts = v.ts as f64 / 1_000_000_000.0;
    let raw_json = serialize_claim(v);

    db_client
        .execute(
            "INSERT INTO claims
                (claim_id, user_id, token_id, status, amount, request_id, to_address, \"desc\", attempt_request_id, transfer_ids, ts, raw_json)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, to_timestamp($11), $12)
                ON CONFLICT (claim_id) DO UPDATE SET
                    user_id = $2,
                    token_id = $3,
                    status = $4,
                    amount = $5,
                    request_id = $6,
                    to_address = $7,
                    \"desc\" = $8,
                    attempt_request_id = $9,
                    transfer_ids = $10,
                    ts = to_timestamp($11),
                    raw_json = $12",
            &[
                &claim_id,
                &user_id,
                &token_id,
                &status,
                &amount,
                &request_id,
                &to_address,
                &desc,
                &attempt_request_id,
                &transfer_ids,
                &ts,
                &raw_json,
            ],
        )
        .await?;

    println!("claim={} saved", v.claim_id);

    Ok(())
}

pub async fn update_claims<T: KongUpdate>(kong_update: &T) -> Result<(), Box<dyn std::error::Error>> {
    let dir_path = "./backups";
    let re_pattern = Regex::new(r"^claims.*.json$").unwrap();
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
        kong_update.update_claims(&contents).await?;
    }

    Ok(())
}
