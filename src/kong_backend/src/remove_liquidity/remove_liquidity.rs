use candid::Nat;
use ic_cdk::update;
use kong_lib::helpers::address_helpers::get_address_from_param;
use transfer_lib::solana::verify_transfer::verify_canonical_message;

use super::remove_liquidity_args::RemoveLiquidityArgs;
use super::remove_liquidity_reply::RemoveLiquidityReply;
use super::remove_liquidity_reply_helpers::{to_remove_liquidity_reply, to_remove_liquidity_reply_failed};

use crate::helpers::nat_helpers::{nat_add, nat_divide, nat_is_zero, nat_multiply, nat_subtract, nat_zero};
use crate::ic::{get_time::get_time, guards::not_in_maintenance_mode};
use crate::stable_claim::claim_map;
use crate::stable_kong_settings::kong_settings_map;
use crate::stable_lp_token::{lp_token_map, stable_lp_token::StableLPToken};
use crate::stable_pool::{pool_map, stable_pool::StablePool};
use crate::stable_request::{reply::Reply, request::Request, request_map, stable_request::StableRequest, status::StatusCode};
use crate::stable_transfer::archive;
use crate::stable_tx::{remove_liquidity_tx::RemoveLiquidityTx, stable_tx::StableTx, tx_map};
use crate::stable_user::user_map;
use crate::transfers::send_token_or_claim::send_token_or_claim;
use crate::transfers::solana::canonical_remove_liquidity::CanonicalRemoveLiquidityMessage;
use kong_lib::ic::address::Address;
use kong_lib::stable_token::{stable_token::StableToken, token::Token};

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
    let (user_id, pool, address_0, address_1, remove_lp_token_amount, payout_amount_0, payout_lp_fee_0, payout_amount_1, payout_lp_fee_1) =
        check_arguments(&args).await?;
    let ts = get_time();
    let request_id = request_map::insert(&StableRequest::new(user_id, &Request::RemoveLiquidity(args), ts));

    let result = match process_remove_liquidity(
        request_id,
        user_id,
        &pool,
        &remove_lp_token_amount,
        &payout_amount_0,
        &payout_lp_fee_0,
        &address_0,
        &payout_amount_1,
        &payout_lp_fee_1,
        &address_1,
        ts,
    )
    .await
    {
        Ok(reply) => {
            request_map::update_status(request_id, StatusCode::Success, None);
            Ok(reply)
        }
        Err(e) => {
            request_map::update_status(request_id, StatusCode::Failed, None);
            Err(e)
        }
    };
    _ = archive_to_kong_data(request_id);

    result
}

/// used by remove_lp_positions() to remove_liquidity for user_id and tokens returned to to_principal_id
pub async fn remove_liquidity_from_pool(
    args: RemoveLiquidityArgs,
    user_id: u32,
) -> Result<RemoveLiquidityReply, String> {
    // We want to remove liquidity for someone else, caller addresses are unused
    let (
        pool,
        _caller_address_0,
        _caller_address_1,
        remove_lp_token_amount,
        payout_amount_0,
        payout_lp_fee_0,
        payout_amount_1,
        payout_lp_fee_1,
    ) = check_arguments_with_user(&args, user_id).await?;

    // Make sure args are passed and check, that these are correct addresses
    let address_0 = args.payout_address_0.clone().ok_or("Address 0 is required".to_string())?;
    let address_1 = args.payout_address_1.clone().ok_or("Address 1 is required".to_string())?;
    let address_0 = get_address_from_param(&pool.token_0(), &Some(address_0))?;
    let address_1 = get_address_from_param(&pool.token_1(), &Some(address_1))?;

    let ts = get_time();
    let request_id = request_map::insert(&StableRequest::new(user_id, &Request::RemoveLiquidity(args), ts));
    request_map::update_status(request_id, StatusCode::RemoveLiquidityFromPool, None);

    let result = match process_remove_liquidity(
        request_id,
        user_id,
        &pool,
        &remove_lp_token_amount,
        &payout_amount_0,
        &payout_lp_fee_0,
        &address_0,
        &payout_amount_1,
        &payout_lp_fee_1,
        &address_1,
        ts,
    )
    .await
    {
        Ok(reply) => {
            request_map::update_status(request_id, StatusCode::Success, None);
            Ok(reply)
        }
        Err(e) => {
            request_map::update_status(request_id, StatusCode::Failed, None);
            Err(e)
        }
    };
    _ = archive_to_kong_data(request_id);

    result
}

#[update]
pub async fn remove_liquidity_async(args: RemoveLiquidityArgs) -> Result<u64, String> {
    let (user_id, pool, address_0, address_1, remove_lp_token_amount, payout_amount_0, payout_lp_fee_0, payout_amount_1, payout_lp_fee_1) =
        check_arguments(&args).await?;
    let ts = get_time();
    let request_id = request_map::insert(&StableRequest::new(user_id, &Request::RemoveLiquidity(args), ts));

    ic_cdk::futures::spawn(async move {
        match process_remove_liquidity(
            request_id,
            user_id,
            &pool,
            &remove_lp_token_amount,
            &payout_amount_0,
            &payout_lp_fee_0,
            &address_0,
            &payout_amount_1,
            &payout_lp_fee_1,
            &address_1,
            ts,
        )
        .await
        {
            Ok(_) => request_map::update_status(request_id, StatusCode::Success, None),
            Err(_) => request_map::update_status(request_id, StatusCode::Failed, None),
        };
        _ = archive_to_kong_data(request_id);
    });

    Ok(request_id)
}

/// returns (user_id, pool, address_0, address_1, remove_lp_token_amount, payout_amount_0, payout_lp_fee_0, payout_amount_1, payout_lp_fee_1)
#[allow(clippy::type_complexity)]
async fn check_arguments(args: &RemoveLiquidityArgs) -> Result<(u32, StablePool, Address, Address, Nat, Nat, Nat, Nat, Nat), String> {
    // make sure user is not anonymous and exists
    let user_id = user_map::get_by_caller()?.ok_or("Insufficient LP balance")?.user_id;
    let (pool, address_0, address_1, remove_lp_token_amount, payout_amount_0, payout_lp_fee_0, payout_amount_1, payout_lp_fee_1) =
        check_arguments_with_user(args, user_id).await?;

    Ok((
        user_id,
        pool,
        address_0,
        address_1,
        remove_lp_token_amount,
        payout_amount_0,
        payout_lp_fee_0,
        payout_amount_1,
        payout_lp_fee_1,
    ))
}

fn verify_canonical_message_args(args: &RemoveLiquidityArgs, token_0: &StableToken, token_1: &StableToken) -> Result<(), String> {
    match (token_0, token_1) {
        (StableToken::LP(_), StableToken::LP(_)) => return Ok(()),
        (StableToken::LP(_), StableToken::IC(_)) => return Ok(()),
        (StableToken::IC(_), StableToken::LP(_)) => return Ok(()),
        (StableToken::IC(_), StableToken::IC(_)) => return Ok(()),
        _ => (),
    }

    let (signature, payout_address) = if let Some(sig_0) = &args.signature_0 {
        // Use signature_0 with payout_address_0
        (sig_0, &args.payout_address_0)
    } else if let Some(sig_1) = &args.signature_1 {
        // Use signature_1 with payout_address_1
        (sig_1, &args.payout_address_1)
    } else {
        return Err("Cross-chain remove liquidity requires signature and corresponding payout address".to_string());
    };

    let payout_address = payout_address
        .as_ref()
        .ok_or("Corresponding address is required for signature".to_string())?;

    // Verify the canonical message signature
    let canonical_message = CanonicalRemoveLiquidityMessage::from_remove_liquidity_args(args);
    let message_str = canonical_message.to_signing_message();

    verify_canonical_message(&message_str, payout_address, signature).map_err(|e| format!("Signature verification failed: {}", e))?;
    Ok(())
}

#[allow(clippy::type_complexity)]
async fn check_arguments_with_user(
    args: &RemoveLiquidityArgs,
    user_id: u32,
) -> Result<(StablePool, Address, Address, Nat, Nat, Nat, Nat, Nat), String> {
    // Pool
    let pool = pool_map::get_by_tokens(&args.token_0, &args.token_1)?;
    let token_0 = pool.token_0();
    let token_1 = pool.token_1();
    let address_0 = get_address_from_param(&token_0, &args.payout_address_0)?;
    let address_1 = get_address_from_param(&token_1, &args.payout_address_1)?;
    // Signature
    verify_canonical_message_args(args, &pool.token_0(), &pool.token_1())?;
    // Token0
    let balance_0 = &pool.balance_0;
    // Token1
    let balance_1 = &pool.balance_1;
    // LP token
    let lp_token = pool.lp_token();
    let lp_token_id = lp_token.token_id();

    if nat_is_zero(balance_0) && nat_is_zero(balance_1) {
        Err("Zero balances in pool".to_string())?
    }

    // Check the user has enough LP tokens
    let user_lp_token_amount =
        lp_token_map::get_by_token_id_by_user_id(lp_token_id, user_id).map_or_else(nat_zero, |lp_token| lp_token.amount);
    let remove_lp_token_amount = if user_lp_token_amount == nat_zero() || args.remove_lp_token_amount > user_lp_token_amount {
        Err("User has insufficient LP balance".to_string())?
    } else {
        args.remove_lp_token_amount.clone()
    };

    // calculate the payout amounts.
    let (payout_amount_0, payout_lp_fee_0, payout_amount_1, payout_lp_fee_1) = calculate_amounts(&pool, &args.remove_lp_token_amount)?;

    Ok((
        pool,
        address_0,
        address_1,
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
    let lp_total_supply = lp_token_map::get_total_supply(lp_token_id);

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
    address_0: &Address,
    payout_amount_1: &Nat,
    payout_lp_fee_1: &Nat,
    address_1: &Address,
    ts: u64,
) -> Result<RemoveLiquidityReply, String> {
    // LP token
    let lp_token = pool.lp_token();

    request_map::update_status(request_id, StatusCode::Start, None);

    // remove LP tokens from user's ledger
    let transfer_lp_token = remove_lp_token(request_id, user_id, &lp_token, remove_lp_token_amount, ts);
    if transfer_lp_token.is_err() {
        return_tokens(request_id, user_id, pool, &transfer_lp_token, remove_lp_token_amount, ts);
        Err(format!("Req #{} failed. {}", request_id, transfer_lp_token.unwrap_err()))?
    }

    // update liquidity pool with new removed amounts
    update_liquidity_pool(request_id, pool, payout_amount_0, payout_lp_fee_0, payout_amount_1, payout_lp_fee_1);

    // successful, add tx and update request with reply
    send_payout_tokens(
        request_id,
        user_id,
        pool,
        payout_amount_0,
        payout_lp_fee_0,
        address_0,
        payout_amount_1,
        payout_lp_fee_1,
        address_1,
        remove_lp_token_amount,
        ts,
    )
    .await
}

fn remove_lp_token(request_id: u64, user_id: u32, lp_token: &StableToken, remove_lp_token_amount: &Nat, ts: u64) -> Result<(), String> {
    // LP token
    let lp_token_id = lp_token.token_id();

    request_map::update_status(request_id, StatusCode::UpdateUserLPTokenAmount, None);

    // make sure user has LP token in ledger and that has enough to remove
    match lp_token_map::get_by_token_id_by_user_id(lp_token_id, user_id) {
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
            let new_user_lp_token = StableLPToken {
                amount,
                ts,
                ..lp_token.clone()
            };
            lp_token_map::update(&new_user_lp_token);
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

fn return_lp_token(user_id: u32, lp_token: &StableToken, remove_lp_token_amount: &Nat, ts: u64) -> Result<(), String> {
    // LP token
    let lp_token_id = lp_token.token_id();

    match lp_token_map::get_by_token_id_by_user_id(lp_token_id, user_id) {
        Some(lp_token) => {
            let new_user_lp_token = StableLPToken {
                amount: nat_add(&lp_token.amount, remove_lp_token_amount),
                ts,
                ..lp_token.clone()
            };
            lp_token_map::update(&new_user_lp_token);
            Ok(())
        }
        None => Err("Unable to find LP tokens balance".to_string())?,
    }
}

fn update_liquidity_pool(request_id: u64, pool: &StablePool, amount_0: &Nat, lp_fee_0: &Nat, amount_1: &Nat, lp_fee_1: &Nat) {
    request_map::update_status(request_id, StatusCode::UpdatePoolAmounts, None);

    let update_pool = StablePool {
        balance_0: nat_subtract(&pool.balance_0, amount_0).unwrap_or(nat_zero()),
        lp_fee_0: nat_subtract(&pool.lp_fee_0, lp_fee_0).unwrap_or(nat_zero()),
        balance_1: nat_subtract(&pool.balance_1, amount_1).unwrap_or(nat_zero()),
        lp_fee_1: nat_subtract(&pool.lp_fee_1, lp_fee_1).unwrap_or(nat_zero()),
        ..pool.clone()
    };
    pool_map::update(&update_pool);
    request_map::update_status(request_id, StatusCode::UpdatePoolAmountsSuccess, None);
}

// send payout tokens to user and final balance integrity checks
// - send payout token_0 and token_1 to user
// - any failures to send tokens will be saved as claims
// - check the actual balances of the canister vs. expected balances in stable memory
// - update successsful request reply
#[allow(clippy::too_many_arguments)]
async fn send_payout_tokens(
    request_id: u64,
    user_id: u32,
    pool: &StablePool,
    payout_amount_0: &Nat,
    payout_lp_fee_0: &Nat,
    address_0: &Address,
    payout_amount_1: &Nat,
    payout_lp_fee_1: &Nat,
    address_1: &Address,
    remove_lp_token_amount: &Nat,
    ts: u64,
) -> Result<RemoveLiquidityReply, String> {
    // Token0
    let token_0 = pool.token_0();
    // Token1
    let token_1 = pool.token_1();

    let mut transfer_ids = Vec::new();
    let mut claim_ids = Vec::new();

    // send payout token_0 to the user
    transfer_token(
        request_id,
        user_id,
        address_0,
        TokenIndex::Token0,
        &token_0,
        payout_amount_0,
        payout_lp_fee_0,
        &mut transfer_ids,
        &mut claim_ids,
        ts,
    )
    .await;

    // send payout token_1 to the user
    transfer_token(
        request_id,
        user_id,
        address_1,
        TokenIndex::Token1,
        &token_1,
        payout_amount_1,
        payout_lp_fee_1,
        &mut transfer_ids,
        &mut claim_ids,
        ts,
    )
    .await;

    let remove_liquidity_tx = RemoveLiquidityTx::new_success(
        pool.pool_id,
        user_id,
        request_id,
        payout_amount_0,
        payout_lp_fee_0,
        payout_amount_1,
        payout_lp_fee_1,
        remove_lp_token_amount,
        &transfer_ids,
        &claim_ids,
        ts,
    );
    let tx_id = tx_map::insert(&StableTx::RemoveLiquidity(remove_liquidity_tx.clone()));
    let reply = match tx_map::get_by_user_and_token_id(Some(tx_id), None, None, None).first() {
        Some(StableTx::RemoveLiquidity(remove_liquidity_tx)) => to_remove_liquidity_reply(remove_liquidity_tx),
        _ => to_remove_liquidity_reply_failed(pool.pool_id, request_id, ts),
    };
    request_map::update_reply(request_id, Reply::RemoveLiquidity(reply.clone()));

    Ok(reply)
}

#[allow(clippy::too_many_arguments)]
async fn transfer_token(
    request_id: u64,
    user_id: u32,
    to_address: &Address,
    token_index: TokenIndex,
    token: &StableToken,
    payout_amount: &Nat,
    payout_lp_fee: &Nat,
    transfer_ids: &mut Vec<u64>,
    claim_ids: &mut Vec<u64>,
    ts: u64,
) {
    // total payout = amount + lp_fee - gas fee
    let amount = nat_add(payout_amount, payout_lp_fee);
    let amount_with_gas = nat_subtract(&amount, &token.fee()).unwrap_or(nat_zero());

    match token_index {
        TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::ReceiveToken0, None),
        TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::ReceiveToken1, None),
    };

    match send_token_or_claim(request_id, user_id, to_address, token, &amount_with_gas, ts).await {
        crate::transfers::send_token_or_claim::ReturnTokenResult::TransferId(transfer_id) => {
            transfer_ids.push(transfer_id);
            match token_index {
                TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::ReceiveToken0Success, None),
                TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::ReceiveToken1Success, None),
            };
        }
        crate::transfers::send_token_or_claim::ReturnTokenResult::ClaimId(claim_id, err) => {
            claim_ids.push(claim_id);
            let message = format!("Saved as claim #{}. {}", claim_id, err);
            match token_index {
                TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::ReceiveToken0Failed, Some(&message)),
                TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::ReceiveToken1Failed, Some(&message)),
            };
        }
    }
}

fn return_tokens(
    request_id: u64,
    user_id: u32,
    pool: &StablePool,
    transfer_lp_token: &Result<(), String>,
    remove_lp_token_amount: &Nat,
    ts: u64,
) {
    // LP token
    let lp_token = pool.lp_token();

    // if transfer_lp_token was successful, then we need to return the LP token back to the user
    if transfer_lp_token.is_ok() {
        request_map::update_status(request_id, StatusCode::ReturnUserLPTokenAmount, None);
        match return_lp_token(user_id, &lp_token, remove_lp_token_amount, ts) {
            Ok(()) => {
                request_map::update_status(request_id, StatusCode::ReturnUserLPTokenAmountSuccess, None);
            }
            Err(e) => {
                request_map::update_status(request_id, StatusCode::ReturnUserLPTokenAmountFailed, Some(&e));
            }
        }
    }

    let reply = to_remove_liquidity_reply_failed(pool.pool_id, request_id, ts);
    request_map::update_reply(request_id, Reply::RemoveLiquidity(reply));
}

fn archive_to_kong_data(request_id: u64) -> Result<(), String> {
    if !kong_settings_map::get().archive_to_kong_data {
        return Ok(());
    }

    let request = request_map::get_by_request_id(request_id).ok_or(format!("Failed to archive. request_id #{} not found", request_id))?;
    request_map::archive_to_kong_data(&request)?;

    match request.reply {
        Reply::RemoveLiquidity(ref reply) => {
            // archive claims
            for claim_id in reply.claim_ids.iter() {
                claim_map::archive_to_kong_data(*claim_id)?;
            }
            // archive transfers
            for transfer_id_reply in reply.transfer_ids.iter() {
                archive::archive_to_kong_data(transfer_id_reply.transfer_id)?;
            }
            // archive txs
            tx_map::archive_to_kong_data(reply.tx_id)?;
        }
        _ => return Err("Invalid reply type".to_string()),
    }

    Ok(())
}

/// api to validate remove_liquidity for SNS proposals
#[update]
fn validate_remove_liquidity() -> Result<String, String> {
    Ok("remove_liquidity is valid".to_string())
}
