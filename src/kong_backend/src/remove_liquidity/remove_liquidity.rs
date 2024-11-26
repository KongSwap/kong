use candid::Nat;
use ic_cdk::update;

use super::remove_liquidity_args::RemoveLiquidityArgs;
use super::remove_liquidity_reply::RemoveLiquidityReply;
use super::remove_liquidity_reply_helpers::{create_remove_liquidity_reply_failed, create_remove_liquidity_reply_with_tx_id};

use crate::helpers::nat_helpers::{nat_add, nat_divide, nat_is_zero, nat_multiply, nat_subtract, nat_zero};
use crate::ic::{
    address::Address, get_time::get_time, guards::not_in_maintenance_mode, id::caller_id, logging::error_log, transfer::icrc1_transfer,
};
use crate::stable_claim::{claim_map, stable_claim::StableClaim};
use crate::stable_lp_token_ledger::{lp_token_ledger, stable_lp_token_ledger::StableLPTokenLedger};
use crate::stable_pool::{pool_map, stable_pool::StablePool};
use crate::stable_request::{reply::Reply, request::Request, request_map, stable_request::StableRequest, status::StatusCode};
use crate::stable_token::{stable_token::StableToken, token::Token};
use crate::stable_transfer::{stable_transfer::StableTransfer, transfer_map, tx_id::TxId};
use crate::stable_tx::{remove_liquidity_tx::RemoveLiquidityTx, stable_tx::StableTx, tx_map};
use crate::stable_user::user_map;

enum TokenIndex {
    Token0,
    Token1,
}

/// remove liquidity from a pool
/// - before calling remove_liquidity(), the user must create an icrc2_approve_transaction for the LP token to
///   allow the backend canister to icrc2_transfer_from. Note, the approve transaction will incur
///   gas fees - which is 1 for LP tokens. However, the icrc2_transfer_from to the backend canister is considered
///   a burn and does not incur gas fees.
///
/// Notes regarding gas:
///   - payout_amount_0, payout_lp_fee_0, payout_amount_1, payout_lp_fee_1 does not include gas fees
#[update(guard = "not_in_maintenance_mode")]
pub async fn remove_liquidity(args: RemoveLiquidityArgs) -> Result<RemoveLiquidityReply, String> {
    // check arguments
    // can use the calculated payout amounts here as no inter-canister calls are made until send_payout_tokens()
    let (user_id, pool, remove_lp_token_amount, payout_amount_0, payout_lp_fee_0, payout_amount_1, payout_lp_fee_1) =
        check_arguments(&args)?;

    // initialize a new remove liquidity request with request_id
    let ts = get_time();
    let request_id = request_map::insert(&StableRequest::new(user_id, &Request::RemoveLiquidity(args.clone()), ts));

    match process_remove_liquidity(
        request_id,
        user_id,
        &pool,
        &remove_lp_token_amount,
        &payout_amount_0,
        &payout_lp_fee_0,
        &payout_amount_1,
        &payout_lp_fee_1,
        ts,
    )
    .await
    {
        Ok(reply) => {
            request_map::update_status(request_id, StatusCode::Success, None);
            Ok(reply)
        }
        Err(e) => {
            request_map::update_status(request_id, StatusCode::Failed, Some(&e));
            Err(e)
        }
    }
}

#[update]
pub async fn remove_liquidity_async(args: RemoveLiquidityArgs) -> Result<u64, String> {
    let (user_id, pool, remove_lp_token_amount, payout_amount_0, payout_lp_fee_0, payout_amount_1, payout_lp_fee_1) =
        check_arguments(&args)?;

    let ts = get_time();
    let request_id = request_map::insert(&StableRequest::new(user_id, &Request::RemoveLiquidity(args.clone()), ts));

    ic_cdk::spawn(async move {
        match process_remove_liquidity(
            request_id,
            user_id,
            &pool,
            &remove_lp_token_amount,
            &payout_amount_0,
            &payout_lp_fee_0,
            &payout_amount_1,
            &payout_lp_fee_1,
            ts,
        )
        .await
        {
            Ok(_) => {
                request_map::update_status(request_id, StatusCode::Success, None);
            }
            Err(e) => {
                request_map::update_status(request_id, StatusCode::Failed, Some(&e));
            }
        }
    });

    // return the request_id asynchrounously
    Ok(request_id)
}

/// returns (user_id, pool, remove_lp_token_amount, payout_amount_0, payout_lp_fee_0, payout_amount_1, payout_lp_fee_1)
#[allow(clippy::type_complexity)]
fn check_arguments(args: &RemoveLiquidityArgs) -> Result<(u32, StablePool, Nat, Nat, Nat, Nat, Nat), String> {
    // Pool
    let pool = pool_map::get_by_tokens(&args.token_0, &args.token_1)?;
    // Token0
    let balance_0 = &pool.balance_0;
    // Token1
    let balance_1 = &pool.balance_1;
    // LP token
    let lp_token = pool.lp_token();
    let lp_token_id = lp_token.token_id();

    if nat_is_zero(balance_0) || nat_is_zero(balance_1) {
        return Err("Zero balance in pool".to_string());
    }

    // Check the user has enough LP tokens.
    let user_lp_token_amount = lp_token_ledger::get_by_token_id(lp_token_id).map_or_else(nat_zero, |lp_token| lp_token.amount);
    let remove_lp_token_amount = if args.remove_lp_token_amount > user_lp_token_amount {
        return Err("Insufficient LP tokens".to_string());
    } else {
        args.remove_lp_token_amount.clone()
    };

    // calculate the payout amounts.
    let (payout_amount_0, payout_lp_fee_0, payout_amount_1, payout_lp_fee_1) = calculate_amounts(&pool, &args.remove_lp_token_amount)?;

    // make sure user is registered, if not create a new user
    let user_id = user_map::insert(None)?;

    Ok((
        user_id,
        pool,
        remove_lp_token_amount,
        payout_amount_0,
        payout_lp_fee_0,
        payout_amount_1,
        payout_lp_fee_1,
    ))
}

pub fn calculate_amounts(pool: &StablePool, remove_lp_token_amount: &Nat) -> Result<(Nat, Nat, Nat, Nat), String> {
    // Token0
    let balance_0 = &pool.balance_0;
    let lp_fee_0 = &pool.lp_fee_0;
    // Token1
    let balance_1 = &pool.balance_1;
    let lp_fee_1 = &pool.lp_fee_1;
    // LP token
    let lp_token = pool.lp_token();
    let lp_token_id = lp_token.token_id();
    let lp_total_supply = lp_token_ledger::get_total_supply(lp_token_id);

    // calculate user's payout in token_0
    // we split the calculations for balance and fees
    // amount_0 = balance_0 * remove_lp_token_amount / lp_total_supply
    let numerator = nat_multiply(balance_0, remove_lp_token_amount);
    let payout_amount_0 = nat_divide(&numerator, &lp_total_supply).ok_or("Invalid LP token amount_0")?;
    // payout_lp_fee_0 = lp_fee_0 * remove_lp_token_amount / lp_total_supply
    let numerator = nat_multiply(lp_fee_0, remove_lp_token_amount);
    let payout_lp_fee_0 = nat_divide(&numerator, &lp_total_supply).ok_or("Invalid LP lp_fee_0")?;

    // calculate user's payout in token_1
    // amount_1 = balance_1 * remove_lp_token_amount / lp_total_supply
    let numerator = nat_multiply(balance_1, remove_lp_token_amount);
    let payout_amount_1 = nat_divide(&numerator, &lp_total_supply).ok_or("Invalid LP token amount_1")?;
    // payout_lp_fee_1 = lp_fee_1 * remove_lp_token_amount / lp_total_supply
    let numerator = nat_multiply(lp_fee_1, remove_lp_token_amount);
    let payout_lp_fee_1 = nat_divide(&numerator, &lp_total_supply).ok_or("Invalid LP lp_fee_1")?;

    Ok((payout_amount_0, payout_lp_fee_0, payout_amount_1, payout_lp_fee_1))
}

#[allow(clippy::too_many_arguments)]
async fn process_remove_liquidity(
    request_id: u64,
    user_id: u32,
    pool: &StablePool,
    remove_lp_token_amount: &Nat,
    payout_amount_0: &Nat,
    payout_lp_fee_0: &Nat,
    payout_amount_1: &Nat,
    payout_lp_fee_1: &Nat,
    ts: u64,
) -> Result<RemoveLiquidityReply, String> {
    // LP token
    let lp_token = pool.lp_token();

    let mut transfer_ids = Vec::new();

    request_map::update_status(request_id, StatusCode::Start, None);

    // remove LP tokens from user's ledger
    let transfer_lp_token = remove_lp_token(request_id, &lp_token, remove_lp_token_amount, ts);

    if transfer_lp_token == Ok(()) {
        // update liquidity pool with new removed amounts
        match update_liquidity_pool(
            request_id,
            pool.pool_id,
            payout_amount_0,
            payout_lp_fee_0,
            payout_amount_1,
            payout_lp_fee_1,
        ) {
            Ok(()) => {
                return Ok(send_payout_tokens_and_check_balances(
                    request_id,
                    user_id,
                    pool,
                    payout_amount_0,
                    payout_lp_fee_0,
                    payout_amount_1,
                    payout_lp_fee_1,
                    remove_lp_token_amount,
                    &mut transfer_ids,
                    ts,
                )
                .await);
            }
            Err(e) => {
                let error = format!("RemoveLiq Req #{}: Failed to update pool: {}", request_id, e);
                error_log(&error);
            }
        }

        // error occurred in updating the pool. no updates to the pool, just return LP tokens
    }

    // 8. otherwise, errors occurred so return LP tokens
    Ok(return_tokens(
        request_id,
        pool,
        &transfer_lp_token,
        remove_lp_token_amount, // send back the LP tokens
        &mut transfer_ids,
        ts,
    )
    .await)
}

fn remove_lp_token(request_id: u64, lp_token: &StableToken, remove_lp_token_amount: &Nat, ts: u64) -> Result<(), String> {
    // LP token
    let lp_token_id = lp_token.token_id();

    request_map::update_status(request_id, StatusCode::UpdateUserLPTokenAmount, None);

    // make sure user has LP token in ledger and that has enough to remove
    match lp_token_ledger::get_by_token_id(lp_token_id) {
        Some(lp_token) => {
            let amount = match nat_subtract(&lp_token.amount, remove_lp_token_amount) {
                Some(amount) => amount,
                None => {
                    let message = format!(
                        "Insufficient LP tokens. {} available, {} required",
                        lp_token.amount, remove_lp_token_amount
                    );
                    request_map::update_status(request_id, StatusCode::UpdateUserLPTokenAmountFailed, Some(&message));
                    Err(message)?
                }
            };
            let new_user_lp_token = StableLPTokenLedger {
                amount,
                ts,
                ..lp_token.clone()
            };
            lp_token_ledger::update(&new_user_lp_token);
            request_map::update_status(request_id, StatusCode::UpdateUserLPTokenAmountSuccess, None);
            Ok(())
        }
        None => {
            let message = format!("Insufficient LP tokens. 0 available, {} required", remove_lp_token_amount);
            request_map::update_status(request_id, StatusCode::UpdateUserLPTokenAmountFailed, Some(&message));
            Err(message)?
        }
    }
}

fn return_lp_token(lp_token: &StableToken, remove_lp_token_amount: &Nat, ts: u64) -> Result<(), String> {
    // LP token
    let lp_token_id = lp_token.token_id();

    match lp_token_ledger::get_by_token_id(lp_token_id) {
        Some(lp_token) => {
            let new_user_lp_token = StableLPTokenLedger {
                amount: nat_add(&lp_token.amount, remove_lp_token_amount),
                ts,
                ..lp_token.clone()
            };
            lp_token_ledger::update(&new_user_lp_token);
            Ok(())
        }
        None => Err("Unable to find user's LP tokens amount".to_string())?,
    }
}

#[allow(clippy::too_many_arguments)]
fn update_liquidity_pool(
    request_id: u64,
    pool_id: u32,
    payout_amount_0: &Nat,
    payout_lp_fee_0: &Nat,
    payout_amount_1: &Nat,
    payout_lp_fee_1: &Nat,
) -> Result<(), String> {
    request_map::update_status(request_id, StatusCode::UpdatePoolAmounts, None);

    // refresh pool with the latest state
    match pool_map::get_by_pool_id(pool_id) {
        Some(pool) => {
            let update_pool = StablePool {
                balance_0: nat_subtract(&pool.balance_0, payout_amount_0).unwrap_or(nat_zero()),
                lp_fee_0: nat_subtract(&pool.lp_fee_0, payout_lp_fee_0).unwrap_or(nat_zero()),
                balance_1: nat_subtract(&pool.balance_1, payout_amount_1).unwrap_or(nat_zero()),
                lp_fee_1: nat_subtract(&pool.lp_fee_1, payout_lp_fee_1).unwrap_or(nat_zero()),
                ..pool.clone()
            };
            _ = pool_map::update(&update_pool); // can ignore the result as it returns the previous value
            Ok(())
        }
        None => {
            let error = format!("Pool id {} not found", pool_id);
            request_map::update_status(request_id, StatusCode::UpdatePoolAmountsFailed, Some(&error));
            Err(error)
        }
    }
}

#[allow(clippy::too_many_arguments)]
async fn transfer_token(
    request_id: u64,
    token_index: TokenIndex,
    token: &StableToken,
    payout_amount: &Nat,
    payout_lp_fee: &Nat,
    transfer_ids: &mut Vec<u64>,
    claim_ids: &mut Vec<u64>,
    user_id: u32,
    ts: u64,
) {
    let symbol = token.symbol();
    let token_id = token.token_id();

    let caller_id = caller_id();

    // total payout = amount + lp_fee - gas fee
    let amount = nat_add(payout_amount, payout_lp_fee);
    let amount_with_gas = nat_subtract(&amount, &token.fee()).unwrap_or(nat_zero());

    match token_index {
        TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::ReceiveToken0, None),
        TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::ReceiveToken1, None),
    };

    match icrc1_transfer(&amount_with_gas, &caller_id, token, None).await {
        Ok(block_id) => {
            let transfer_id = transfer_map::insert(&StableTransfer {
                transfer_id: 0,
                request_id,
                is_send: false,
                amount: amount_with_gas,
                token_id,
                tx_id: TxId::BlockIndex(block_id),
                ts,
            });
            transfer_ids.push(transfer_id);
            match token_index {
                TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::ReceiveToken0Success, None),
                TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::ReceiveToken1Success, None),
            };
        }
        Err(e) => {
            let claim_id = claim_map::insert(&StableClaim::new(
                user_id,
                token_id,
                &amount,
                Some(request_id),
                Some(Address::PrincipalId(caller_id)),
                ts,
            ));
            claim_ids.push(claim_id);
            error_log(&format!(
                "RemoveLiq Req #{}: Kong failed to send {} {}. Claim #{}: {}",
                request_id, amount, symbol, claim_id, e
            ));
            match token_index {
                TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::ReceiveToken0Failed, Some(&e)),
                TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::ReceiveToken1Failed, Some(&e)),
            };
        }
    }
}

// send payout tokens to user and final balance integrity checks
// - send payout token_0 and token_1 to user
// - any failures to send tokens will be saved as claims
// - check the actual balances of the canister vs. expected balances in stable memory
// - update successsful request reply
#[allow(clippy::too_many_arguments)]
async fn send_payout_tokens_and_check_balances(
    request_id: u64,
    user_id: u32,
    pool: &StablePool,
    payout_amount_0: &Nat,
    payout_lp_fee_0: &Nat,
    payout_amount_1: &Nat,
    payout_lp_fee_1: &Nat,
    remove_lp_token_amount: &Nat,
    transfer_ids: &mut Vec<u64>,
    ts: u64,
) -> RemoveLiquidityReply {
    // Token0
    let token_0 = pool.token_0();
    // Token1
    let token_1 = pool.token_1();

    let mut claim_ids = Vec::new();

    // send payout token_0 to the user
    transfer_token(
        request_id,
        TokenIndex::Token0,
        &token_0,
        payout_amount_0,
        payout_lp_fee_0,
        transfer_ids,
        &mut claim_ids,
        user_id,
        ts,
    )
    .await;

    // send payout token_1 to the user
    transfer_token(
        request_id,
        TokenIndex::Token1,
        &token_1,
        payout_amount_1,
        payout_lp_fee_1,
        transfer_ids,
        &mut claim_ids,
        user_id,
        ts,
    )
    .await;

    request_map::update_status(request_id, StatusCode::Success, None);

    let remove_liquidity_tx = RemoveLiquidityTx::new_success(
        pool.pool_id,
        user_id,
        request_id,
        payout_amount_0,
        payout_lp_fee_0,
        payout_amount_1,
        payout_lp_fee_1,
        remove_lp_token_amount,
        transfer_ids,
        &claim_ids,
        ts,
    );
    let tx_id = tx_map::insert(&StableTx::RemoveLiquidity(remove_liquidity_tx.clone()));
    let reply = create_remove_liquidity_reply_with_tx_id(tx_id, &remove_liquidity_tx);
    request_map::update_reply(request_id, Reply::RemoveLiquidity(reply.clone()));
    reply
}

#[allow(clippy::too_many_arguments)]
async fn return_tokens(
    request_id: u64,
    pool: &StablePool,
    transfer_lp_token: &Result<(), String>,
    remove_lp_token_amount: &Nat,
    transfer_ids: &mut [u64],
    ts: u64,
) -> RemoveLiquidityReply {
    // LP token
    let lp_token = pool.lp_token();

    if transfer_lp_token.is_ok() {
        // if transfer_lp_token was successful, then we need to return the LP token back to the user
        request_map::update_status(request_id, StatusCode::ReturnUserLPTokenAmount, None);

        // return back remove_lp_token_amount of lp_token to user
        match return_lp_token(&lp_token, remove_lp_token_amount, ts) {
            Ok(()) => {
                request_map::update_status(request_id, StatusCode::ReturnUserLPTokenAmountSuccess, None);
            }
            Err(e) => {
                error_log(&format!(
                    "RemoveLiq Req #{}: Kong failed to return {} {}: {}",
                    request_id,
                    remove_lp_token_amount,
                    lp_token.symbol(),
                    e,
                ));
                request_map::update_status(request_id, StatusCode::ReturnUserLPTokenAmountFailed, Some(&e));
            }
        }
    }

    request_map::update_status(request_id, StatusCode::Failed, None);

    let reply = create_remove_liquidity_reply_failed(pool.pool_id, request_id, transfer_ids, ts);
    request_map::update_reply(request_id, Reply::RemoveLiquidity(reply.clone()));
    reply
}

/// api to validate remove_liquidity for SNS proposals
#[update]
fn validate_remove_liquidity() -> Result<String, String> {
    Ok("remove_liquidity is valid".to_string())
}
