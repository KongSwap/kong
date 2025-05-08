pub mod agent;
pub mod icrc1;
pub mod icrc3;
pub mod identity;

use agent::get_agent;
use anyhow::{Context, Result};
use candid::{Nat, Principal};
use clap::Parser;
use identity::get_anonymous_identity;
use serde_json::json;

use icrc1::{
    icrc1_decimals, icrc1_fee, icrc1_name, icrc1_supported_standards, icrc1_symbol,
    icrc1_total_supply,
};
use icrc3::icrc3_get_blocks;

#[derive(Parser, Debug)]
#[command(version, about, long_about = None)] // Optional: Add version and about info
struct Args {
    /// Use mainnet replica (otherwise local)
    #[arg(long, default_value_t = false)]
    mainnet: bool,

    #[arg(long("icrc1_supported_standards"))]
    icrc1_supported_standards: Option<String>,

    #[arg(long("icrc1_decimals"))]
    icrc1_decimals: Option<String>,

    #[arg(long("icrc1_fee"))]
    icrc1_fee: Option<String>,

    #[arg(long("icrc1_name"))]
    icrc1_name: Option<String>,

    #[arg(long("ledger_id"))]
    icrc1_symbol: Option<String>,

    #[arg(long("icrc1_total_supply"))]
    icrc1_total_supply: Option<String>,

    #[arg(long("icrc3_get_blocks"))]
    icrc3_get_blocks: Option<String>,

    #[arg(long("icrc3_get_blocks_block_index"))]
    icrc3_get_blocks_block_index: Option<u128>,
}

#[tokio::main]
async fn main() -> Result<()> {
    let args = Args::parse();
    let mainnet = args.mainnet;
    let identity = get_anonymous_identity().context("Failed to get IC anonymous identity")?;
    let agent = get_agent(identity, Some(mainnet))
        .await
        .context("Failed to create IC agent")?;

    if let Some(canister_id) = args.icrc1_supported_standards {
        let canister_id =
            Principal::from_text(&canister_id).context("Failed to parse canister ID")?;
        let icrc1_supported_standards = icrc1_supported_standards(&agent, &canister_id)
            .await
            .context("Failed to get ICRC1 supported standards")?;
        println!(
            "ICRC1 Supported Standards: {}",
            json!(icrc1_supported_standards)
        );
    }

    if let Some(canister_id) = args.icrc1_decimals {
        let canister_id =
            Principal::from_text(&canister_id).context("Failed to parse canister ID")?;
        let icrc1_decimals = icrc1_decimals(&agent, &canister_id)
            .await
            .context("Failed to get ICRC1 decimals")?;
        println!("ICRC1 Decimals: {}", json!(icrc1_decimals));
    }

    if let Some(canister_id) = args.icrc1_fee {
        let canister_id =
            Principal::from_text(&canister_id).context("Failed to parse canister ID")?;
        let icrc1_fee = icrc1_fee(&agent, &canister_id)
            .await
            .context("Failed to get ICRC1 fee")?;
        println!("ICRC1 Fee: {}", json!(icrc1_fee.to_string()));
    }

    if let Some(canister_id) = args.icrc1_name {
        let canister_id =
            Principal::from_text(&canister_id).context("Failed to parse canister ID")?;
        let icrc1_name = icrc1_name(&agent, &canister_id)
            .await
            .context("Failed to get ICRC1 name")?;
        println!("ICRC1 Name: {}", json!(icrc1_name));
    }

    if let Some(canister_id) = args.icrc1_symbol {
        let canister_id =
            Principal::from_text(&canister_id).context("Failed to parse canister ID")?;
        let icrc1_symbol = icrc1_symbol(&agent, &canister_id)
            .await
            .context("Failed to get ICRC1 symbol")?;
        println!("ICRC1 Symbol: {}", json!(icrc1_symbol));
    }

    if let Some(canister_id) = args.icrc1_total_supply {
        let canister_id =
            Principal::from_text(&canister_id).context("Failed to parse canister ID")?;
        let icrc1_total_supply = icrc1_total_supply(&agent, &canister_id)
            .await
            .context("Failed to get ICRC1 total supply")?;
        println!(
            "ICRC1 Total Supply: {}",
            json!(icrc1_total_supply.to_string())
        );
    }

    if let Some(canister_id) = args.icrc3_get_blocks {
        let canister_id =
            Principal::from_text(&canister_id).context("Failed to parse canister ID")?;
        if let Some(block_index) = args.icrc3_get_blocks_block_index {
            let block_index = Nat::from(block_index);
            let _icrc3_get_blocks = icrc3_get_blocks(&agent, &canister_id, block_index)
                .await
                .context("Failed to get ICRC3 blocks")?;
        }
    }

    Ok(())
}
