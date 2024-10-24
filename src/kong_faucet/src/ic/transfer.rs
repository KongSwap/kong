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
    // 1. Asynchronously call another canister function using `ic_cdk::call`.
    match ic_cdk::call::<(TransferArg,), (Result<Nat, TransferError>,)>(
        // 2. Convert a textual representation of a Principal into an actual `Principal` object. The principal is the one we specified in `dfx.json`.
        //    `expect` will panic if the conversion fails, ensuring the code does not proceed with an invalid principal.
        *ledger,
        // 3. Specify the method name on the target canister to be called, in this case, "icrc1_transfer".
        "icrc1_transfer",
        // 4. Provide the arguments for the call in a tuple, here `transfer_args` is encapsulated as a single-element tuple.
        (transfer_args,),
    )
    .await // 5. Await the completion of the asynchronous call, pausing the execution until the future is resolved.
    // 6. Apply `map_err` to transform any network or system errors encountered during the call into a more readable string format.
    //    The `?` operator is then used to propagate errors: if the result is an `Err`, it returns from the function with that error,
    //    otherwise, it unwraps the `Ok` value, allowing the chain to continue.
    .map_err(|e| format!("Failed to call ledger: {:?}", e))?
    // 7. Access the first element of the tuple, which is the `Result<BlockIndex, TransferError>`, for further processing.
    .0
    {
        // 8. If the result is `Ok`, push the `BlockIndex` into the `tx_ids` vector.
        Ok(tx_id) => Ok(tx_id),
        // 9. If the result is `Err`, return a string representation of the `TransferError`.
        Err(e) => Err(format!("Failed to transfer: {:?}", e))?,
    }
}
