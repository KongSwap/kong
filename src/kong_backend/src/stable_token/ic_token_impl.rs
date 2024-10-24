use candid::Principal;

use super::ic_token::ICToken;

use crate::ic::ledger::{get_decimals, get_fee, get_name, get_supported_standards, get_symbol};
use crate::chains::chains::IC_CHAIN;

impl ICToken {
    pub async fn new(canister_id: &Principal, on_kong: bool) -> Result<Self, String> {
        let name = get_name(canister_id).await?;
        let symbol = get_symbol(canister_id).await?;
        let decimals = get_decimals(canister_id).await?;
        let fee = get_fee(canister_id).await?;
        let (icrc1, icrc2, icrc3) = match get_supported_standards(canister_id).await {
            Ok(supported_standards) => {
                let icrc1 = supported_standards.iter().any(|standard| standard.name == "ICRC-1");
                let icrc2 = supported_standards.iter().any(|standard| standard.name == "ICRC-2");
                let icrc3 = supported_standards.iter().any(|standard| standard.name == "ICRC-3");
                (icrc1, icrc2, icrc3)
            }
            Err(_) => (true, false, false), // should at least support ICRC-1 if it made it this far
        };
        Ok(Self {
            token_id: 0,
            name,
            symbol,
            canister_id: *canister_id,
            decimals,
            fee,
            icrc1,
            icrc2,
            icrc3,
            on_kong,
        })
    }

    pub fn chain(&self) -> String {
        IC_CHAIN.to_string()
    }
}
