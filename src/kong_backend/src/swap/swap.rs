use ic_cdk::update;

use super::swap_args::SwapArgs;
use super::swap_reply::SwapReply;
use super::swap_transfer::{swap_transfer, swap_transfer_async};
use super::swap_transfer_from::{swap_transfer_from, swap_transfer_from_async};

use crate::ic::guards::not_in_maintenance_mode;

/// Pay and Receive are from the user's perspective

/// Swap tokens
#[update(guard = "not_in_maintenance_mode")]
pub async fn swap(args: SwapArgs) -> Result<SwapReply, String> {
    // determine if using icrc2_approve+icrc2_transfer_from or icrc1_transfer method
    if args.pay_tx_id.is_none() {
        swap_transfer_from(args).await
    } else {
        swap_transfer(args).await
    }
}

/// Swap tokens asynchronously
#[update(guard = "not_in_maintenance_mode")]
pub async fn swap_async(args: SwapArgs) -> Result<u64, String> {
    // determine if using icrc2_approve+icrc2_transfer_from or icrc1_transfer method
    if args.pay_tx_id.is_none() {
        swap_transfer_from_async(args).await
    } else {
        swap_transfer_async(args).await
    }
}
