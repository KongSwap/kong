use candid::{Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};

use crate::KONG_LEDGER_ID;
use crate::types::TokenAmount;

// Minter addresses for the KONG token (this is where tokens get "burned")
// Production minter address: oypg6-faaaa-aaaaq-aadza-cai
// Local testing minter address: a5dhi-k7777-77775-aaabq-cai
pub const KONG_MINTER_PRINCIPAL_PROD: &str = "oypg6-faaaa-aaaaq-aadza-cai";
pub const KONG_MINTER_PRINCIPAL_LOCAL: &str = "faaxe-sf6cf-hmx3r-ujxc6-7ppwl-3lkf3-zpj6i-2m75x-bqmba-dod7q-4qe";

pub async fn transfer_kong(to: Principal, amount: TokenAmount) -> Result<String, String> {
    ic_cdk::println!("Transferring {} KONG to {}", amount.to_u64(), to.to_string());

    let args = TransferArg {
        from_subaccount: None,
        to: Account {
            owner: to,
            subaccount: None,
        },
        amount: amount.inner().clone(),
        fee: None,
        memo: None,
        created_at_time: None,
    };

    let ledger = Principal::from_text(KONG_LEDGER_ID).map_err(|e| format!("Invalid ledger ID: {}", e))?;

    match ic_cdk::call::<(TransferArg,), (Result<Nat, TransferError>,)>(ledger, "icrc1_transfer", (args,)).await {
        Ok((Ok(block_index),)) => Ok(block_index.to_string()),
        Ok((Err(e),)) => Err(format!("Transfer failed: {:?}", e)),
        Err((code, msg)) => Err(format!("Transfer failed: {} (code: {:?})", msg, code)),
    }
}

/// Burns tokens by sending them to the minter principal
/// This is used as a penalty when a market creator's resolution conflicts with admin's
/// Returns the transaction ID of the burn if successful
pub async fn burn_tokens(amount: TokenAmount) -> Result<String, String> {
    ic_cdk::println!("BURNING {} KONG tokens by sending to minter", amount.to_u64());
    
    // Select the appropriate minter principal based on which ledger we're using
    let minter_address = if KONG_LEDGER_ID == "o7oak-iyaaa-aaaaq-aadzq-cai" {
        // Production environment
        KONG_MINTER_PRINCIPAL_PROD
    } else {
        // Local or test environment
        KONG_MINTER_PRINCIPAL_LOCAL
    };
    
    ic_cdk::println!("Using minter address: {}", minter_address);
    
    // Parse the minter principal
    let minter = Principal::from_text(minter_address)
        .map_err(|e| format!("Invalid minter principal: {}", e))?;
        
    // Transfer to the minter (effectively burning the tokens)
    transfer_kong(minter, amount).await
}
