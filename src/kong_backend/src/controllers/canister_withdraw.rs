use candid::{CandidType, Deserialize, Nat};
use ic_cdk::update;
use serde_json::json;

use crate::ic::guards::caller_is_kingkong;
use crate::ic::id::caller_id;
use crate::ic::transfer::icrc1_transfer;
use crate::stable_token::token::Token;
use crate::stable_token::token_map;

#[derive(CandidType, Deserialize)]
pub struct CanisterWithdrawArgs {
    token: String,
    amount: Nat,
}

/// For emergency use only.
#[update(hidden = true, guard = "caller_is_kingkong")]
async fn canister_withdraw(args: CanisterWithdrawArgs) -> Result<String, String> {
    let token = token_map::get_by_token(&args.token)?;
    let tx_id = icrc1_transfer(&args.amount, &caller_id(), &token, None).await?;

    let response = json! {
        {
            "ledger": token.address(),
            "tx_id": tx_id,
        }
    };

    serde_json::to_string(&response).map_err(|e| format!("Failed to serialize: {}", e))
}
