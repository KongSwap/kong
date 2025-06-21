use ic_cdk::update;

use super::add_liquidity_args::AddLiquidityArgs;
use super::add_liquidity_reply::AddLiquidityReply;
use super::add_liquidity_transfer::{add_liquidity_transfer, add_liquidity_transfer_async};
use super::add_liquidity_transfer_from::{add_liquidity_transfer_from, add_liquidity_transfer_from_async};

use crate::ic::guards::not_in_maintenance_mode;

pub enum TokenIndex {
    Token0,
    Token1,
}

/// Add liquidity to a pool
///
/// - before calling add_liquidity, the user must create icrc2_approve_transactions for both tokens to
///   allow the backend canister to icrc2_transfer_from. Note, the approve transactions must account
///   for the gas fee. For example, to approve the transfer of 1 ICP, the approve amount needs to be
///   100_000_000 + 10_000 (10_000 is the gas fee) = 100_010_000.
///
/// Arguments: AddLiquidityArgs
///  symbol_0: symbol of token_0 eg. "ckBTC"
///  amount_0: amount of token_0 to add (nat) eg. 100_000_000 is 1 ICP
///  symbol_1: symbol of token_1 eg. "ckUSDT". Currently only ckUSDT as all pools against ckUSDT
///  amount_1: amount of token_1 to add (nat) eg. 1_000_000 is 1 ckUSDT
///
/// Returns: AddLiquidityReply
///  pay_symbol: name of the pool eg. "ckBTC_ckUSDT"
///  tx_id: transaction id of the add_liquidity transaction
///  request_id: request id of the add_liquidity request
///  status: status of the add_liquidity transaction
///  symbol_0: symbol of token_0
///  amount_0: amount of token_0 added
///  symbol_1: symbol of token_1
///  amount_1: amount of token_1 added
///  price: price of the pool after the add_liquidity transaction
///  add_lp_token_amount: amount of LP tokens for the user
///  total_user_lp_token: total LP tokens held by the user
///  pct_user_lp_token: percentage of LP tokens held by the user
///  total_supply_lp_token: total LP tokens in the pool
///  tx_ids: block ides of the token transfers
///  ts: timestamp of the add_liquidity transaction
///
/// Steps:
/// 1. check_arguments() - check the arguments and return what's needed
/// 2. calculate_amounts() - calculate the amounts to be added to the pool to contain constant K - add_amount_0, add_amount_1
/// 3. check_amounts() - check user has balance and allowance for both tokens that add_amount_0 and add_amount_1 can be transferred
/// 4. transfer_from_token() - transfer token_0 to pool
/// 5. transfer_from_token() - transfer token_1 to pool
/// 6. calculate_amounts() - re-calculate the amounts to be added to the pool with new state with amount_0, amount_1, lp_token being the final amounts
/// 7. update_liquidity_pool() - update pool with amount_0, amount_1, add_lp_token_amount
/// 8. send_lp_token() - if no errors, send add_lp_token_amount to user. send back any extra (add_amount_0 - amount) and (add_amount_1 - amount)
/// 9. return_tokens() - otherwise if any errors occurred, return tokens
#[update(guard = "not_in_maintenance_mode")]
pub async fn add_liquidity(args: AddLiquidityArgs) -> Result<AddLiquidityReply, String> {
    // Route based on presence of signatures (cross-chain) or tx_ids (IC-only)
    // If signatures are present, use transfer_from flow for cross-chain support
    // Otherwise, check tx_ids for IC-only transfer flow
    if args.signature_0.is_some() || args.signature_1.is_some() {
        // Cross-chain flow (Solana tokens with signatures)
        add_liquidity_transfer_from(args).await
    } else if args.tx_id_0.is_none() && args.tx_id_1.is_none() {
        // ICRC2 approve flow
        add_liquidity_transfer_from(args).await
    } else {
        // IC-only transfer flow (with BlockIndex tx_ids)
        add_liquidity_transfer(args).await
    }
}

/// add liquidity to a pool asynchronously. same as add_liquidity() but returns the request_id immediately
///
/// Arguments: AddLiquidityArgs
/// symbol_0: symbol of token_0 eg. "ckBTC"
/// amount_0: amount of token_0 to add (nat) eg. 100_000_000 is 1 ICP
/// symbol_1: symbol of token_1 eg. "ckUSDT"
/// amount_1: amount of token_1 to add (nat) eg. 1_000_000 is 1 ckUSDT
///
/// Returns: u64 - request_id. poll requests(request_id) to return the current status of the request
#[update(guard = "not_in_maintenance_mode")]
pub async fn add_liquidity_async(args: AddLiquidityArgs) -> Result<u64, String> {
    // Route based on presence of signatures (cross-chain) or tx_ids (IC-only)
    // If signatures are present, use transfer_from flow for cross-chain support
    // Otherwise, check tx_ids for IC-only transfer flow
    if args.signature_0.is_some() || args.signature_1.is_some() {
        // Cross-chain flow (Solana tokens with signatures)
        add_liquidity_transfer_from_async(args).await
    } else if args.tx_id_0.is_none() && args.tx_id_1.is_none() {
        // ICRC2 approve flow
        add_liquidity_transfer_from_async(args).await
    } else {
        // IC-only transfer flow (with BlockIndex tx_ids)
        add_liquidity_transfer_async(args).await
    }
}

/// api to validate add_liquidity for SNS proposals
#[update]
fn validate_add_liquidity() -> Result<String, String> {
    Ok("add_liquidity is valid".to_string())
}
