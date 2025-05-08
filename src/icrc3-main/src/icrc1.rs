use anyhow::Result;
use candid::{CandidType, Decode, Encode, Nat, Principal};
use ic_agent::Agent;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Debug)]
pub struct Icrc1SupportedStandards {
    url: String,
    name: String,
}

pub async fn icrc1_supported_standards(
    agent: &Agent,
    canister_id: &Principal,
) -> Result<Vec<Icrc1SupportedStandards>> {
    let response = agent
        .query(canister_id, "icrc1_supported_standards")
        .with_arg(Encode!().unwrap())
        .await?;
    let icrc1_supported_standards = Decode!(&response.as_slice(), Vec<Icrc1SupportedStandards>)?;

    Ok(icrc1_supported_standards)
}

pub async fn icrc1_decimals(agent: &Agent, canister_id: &Principal) -> Result<u8> {
    let response = agent
        .query(canister_id, "icrc1_decimals")
        .with_arg(Encode!().unwrap())
        .await?;
    let icrc1_decimals = Decode!(&response.as_slice(), u8)?;

    Ok(icrc1_decimals)
}

pub async fn icrc1_fee(agent: &Agent, canister_id: &Principal) -> Result<Nat> {
    let response = agent
        .query(canister_id, "icrc1_fee")
        .with_arg(Encode!().unwrap())
        .await?;
    let icrc1_fee = Decode!(&response.as_slice(), Nat)?;

    Ok(icrc1_fee)
}

pub async fn icrc1_name(agent: &Agent, canister_id: &Principal) -> Result<String> {
    let response = agent
        .query(canister_id, "icrc1_name")
        .with_arg(Encode!().unwrap())
        .await?;
    let icrc1_name = Decode!(&response.as_slice(), String)?;

    Ok(icrc1_name)
}

pub async fn icrc1_symbol(agent: &Agent, canister_id: &Principal) -> Result<String> {
    let response = agent
        .query(canister_id, "icrc1_symbol")
        .with_arg(Encode!().unwrap())
        .await?;
    let icrc1_symbol = Decode!(&response.as_slice(), String)?;

    Ok(icrc1_symbol)
}

pub async fn icrc1_total_supply(agent: &Agent, canister_id: &Principal) -> Result<Nat> {
    let response = agent
        .query(canister_id, "icrc1_total_supply")
        .with_arg(Encode!().unwrap())
        .await?;
    let icrc1_total_supply = Decode!(&response.as_slice(), Nat)?;

    Ok(icrc1_total_supply)
}
