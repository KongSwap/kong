use candid::{Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};

use crate::nat::*;
use crate::KONG_LEDGER_ID;

pub async fn transfer_kong(to: Principal, amount: StorableNat) -> Result<(), String> {
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
        Ok((Ok(_block_index),)) => Ok(()),
        Ok((Err(e),)) => Err(format!("Transfer failed: {:?}", e)),
        Err((code, msg)) => Err(format!("Transfer failed: {} (code: {:?})", msg, code)),
    }
}
