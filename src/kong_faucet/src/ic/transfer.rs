use candid::{Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};

// transfer icrc1 token using principal id
pub async fn icrc1_transfer(amount: &Nat, to_principal_id: &Account, ledger: &Principal) -> Result<Nat, String> {
    let transfer_args: TransferArg = TransferArg {
        memo: None,
        amount: amount.clone(),
        from_subaccount: None,
        fee: None,
        to: *to_principal_id,
        created_at_time: None,
    };
    match ic_cdk::call::Call::unbounded_wait(*ledger, "icrc1_transfer")
    .with_arg(transfer_args)
    .await
    .map_err(|e| e.to_string())?
    .candid::<Result<Nat, TransferError>>()
    .map_err(|e| format!("Failed to call ledger: {:?}", e))?
    {
        Ok(tx_id) => Ok(tx_id),
        Err(e) => Err(format!("Failed to transfer: {:?}", e))?,
    }
}
