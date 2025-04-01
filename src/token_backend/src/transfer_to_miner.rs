use candid::{Nat, Principal};
use ic_cdk::api::call::call;
use icrc_ledger_types::icrc1::{account::Account, transfer::{TransferArg, TransferError, BlockIndex}};

/// Performs an ICRC1 transfer from this canister to the miner.
pub(crate) async fn transfer_to_miner(ledger_id: Principal, miner: Principal, reward: u64) -> Result<(), String> {
    if reward == 0 {
        ic_cdk::println!("Reward is 0 for miner {}, skipping transfer.", miner);
        return Ok(()); // No transfer needed if reward is zero
    }

    ic_cdk::println!("Attempting to transfer reward {} to miner {} via ledger {}", reward, miner, ledger_id);

    let transfer_args = TransferArg {
        from_subaccount: None,
        to: Account { owner: miner, subaccount: None },
        amount: Nat::from(reward),
        fee: None, // Use default fee configured in the ledger
        memo: None,
        created_at_time: Some(ic_cdk::api::time()), // Use current time for transfer timestamp
    };

    match call::<(TransferArg,), (Result<BlockIndex, TransferError>,)>(ledger_id, "icrc1_transfer", (transfer_args,)).await {
        Ok((inner_transfer_result,)) => {
            match inner_transfer_result {
                Ok(block_index) => {
                    ic_cdk::println!("Ledger transfer successful to miner {} at block index {}.", miner, block_index);
                    Ok(()) // Transfer successful
                }
                Err(transfer_error) => {
                    ic_cdk::println!("Ledger transfer failed for miner {}: {:?}", miner, transfer_error);
                    Err(format!("Ledger transfer failed: {:?}", transfer_error))
                }
            }
        }
        Err((code, msg)) => { // Handle rejection from the IC call itself
             ic_cdk::println!("Ledger transfer call failed for miner {}: {} (code: {:?})", miner, msg, code);
            Err(format!("Ledger transfer call failed: {} (code: {:?})", msg, code))
        }
    }
}
