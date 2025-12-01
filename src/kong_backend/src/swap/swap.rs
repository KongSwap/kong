use ic_cdk::update;

use super::swap_args::SwapArgs;
use super::swap_reply::SwapReply;
use super::swap_transfer::{swap_transfer, swap_transfer_async};

use crate::ic::guards::not_in_maintenance_mode;

/// Pay and Receive are from the user's perspective
/// Swap tokens
#[update(guard = "not_in_maintenance_mode")]
pub async fn swap(args: SwapArgs) -> Result<SwapReply, String> {
    swap_transfer(args).await
}

/// Swap tokens asynchronously
#[update(guard = "not_in_maintenance_mode")]
pub async fn swap_async(args: SwapArgs) -> Result<u64, String> {
    swap_transfer_async(args).await
}
