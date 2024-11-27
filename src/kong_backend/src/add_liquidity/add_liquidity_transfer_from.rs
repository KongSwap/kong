use candid::Nat;

use super::add_liquidity::TokenIndex;
use super::add_liquidity_args::AddLiquidityArgs;
use super::add_liquidity_reply::AddLiquidityReply;
use super::add_liquidity_reply_helpers::{create_add_liquidity_reply_failed, create_add_liquidity_reply_with_tx_id};

use crate::helpers::nat_helpers::{
    nat_add, nat_divide, nat_is_zero, nat_multiply, nat_sqrt, nat_subtract, nat_to_decimal_precision, nat_zero,
};
use crate::ic::{
    address::Address,
    get_time::get_time,
    id::caller_id,
    logging::error_log,
    transfer::{icrc1_transfer, icrc2_transfer_from},
};
use crate::stable_claim::{claim_map, stable_claim::StableClaim};
use crate::stable_kong_settings::kong_settings;
use crate::stable_lp_token::{lp_token_map, stable_lp_token::StableLPToken};
use crate::stable_pool::{pool_map, stable_pool::StablePool};
use crate::stable_request::{reply::Reply, request::Request, request_map, stable_request::StableRequest, status::StatusCode};
use crate::stable_token::{stable_token::StableToken, token::Token};
use crate::stable_transfer::{stable_transfer::StableTransfer, transfer_map, tx_id::TxId};
use crate::stable_tx::{add_liquidity_tx::AddLiquidityTx, stable_tx::StableTx, tx_map};
use crate::stable_user::user_map;

pub async fn add_liquidity_transfer_from(args: AddLiquidityArgs) -> Result<AddLiquidityReply, String> {
    let (user_id, pool, add_amount_0, add_amount_1) = check_arguments(&args).await?;

    let ts = get_time();
    let request_id = request_map::insert(&StableRequest::new(user_id, &Request::AddLiquidity(args), ts));

    match process_add_liquidity(request_id, user_id, &pool, &add_amount_0, &add_amount_1, ts).await {
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

pub async fn add_liquidity_transfer_from_async(args: AddLiquidityArgs) -> Result<u64, String> {
    let (user_id, pool, add_amount_0, add_amount_1) = check_arguments(&args).await?;

    let ts = get_time();
    let request_id = request_map::insert(&StableRequest::new(user_id, &Request::AddLiquidity(args), ts));

    ic_cdk::spawn(async move {
        match process_add_liquidity(request_id, user_id, &pool, &add_amount_0, &add_amount_1, ts).await {
            Ok(_) => request_map::update_status(request_id, StatusCode::Success, None),
            Err(e) => request_map::update_status(request_id, StatusCode::Failed, Some(&e)),
        };
    });

    Ok(request_id)
}

async fn check_arguments(args: &AddLiquidityArgs) -> Result<(u32, StablePool, Nat, Nat), String> {
    if nat_is_zero(&args.amount_0) || nat_is_zero(&args.amount_1) {
        return Err("Invalid zero amounts".to_string());
    }

    // check to make sure tx_id_0 and tx_id_1 is not specified
    if args.tx_id_0.is_some() || args.tx_id_1.is_some() {
        return Err("Tx_id_0 and Tx_id_1 not supported".to_string());
    }

    // add_amount_0 and add_amount_1 are the amounts to be added to the pool with the current state
    // these are the amounts that will be transferred to the pool
    let (pool, add_amount_0, add_amount_1, _) = calculate_amounts(&args.token_0, &args.amount_0, &args.token_1, &args.amount_1)?;

    // make sure user is registered, if not create a new user
    let user_id = user_map::insert(None).await?;

    Ok((user_id, pool, add_amount_0, add_amount_1))
}

/// calculate the ratio of amounts (amount_0 and amount_1) to be added to the pool to maintain constant K
/// calculate the LP token amount for the user
///
/// returns (amount_0, amount_1, add_lp_token_amount)
pub fn calculate_amounts(token_0: &str, amount_0: &Nat, token_1: &str, amount_1: &Nat) -> Result<(StablePool, Nat, Nat, Nat), String> {
    // Pool - make sure pool exists, refresh balances of the pool to make sure we have the latest state
    let pool = pool_map::get_by_tokens(token_0, token_1)?;
    // Token0
    let token_0 = pool.token_0();
    let symbol_0 = pool.symbol_0();
    // reserve_0 is the total balance of token_0 in the pool = balance_0 + lp_fee_0
    let reserve_0 = nat_add(&pool.balance_0, &pool.lp_fee_0);
    // Token1
    let token_1 = pool.token_1();
    let symbol_1 = pool.symbol_1();
    let reserve_1 = nat_add(&pool.balance_1, &pool.lp_fee_1);
    // LP token
    let lp_token = pool.lp_token();
    let lp_token_id = lp_token.token_id();
    let lp_total_supply = lp_token_map::get_total_supply(lp_token_id);

    if nat_is_zero(&reserve_0) && nat_is_zero(&reserve_1) {
        // new pool as there are no balances - take user amounts as initial ratio
        // initialize LP tokens as sqrt(amount_0 * amount_1)
        // convert the amounts to the same decimal precision as the LP token
        let amount_0_in_lp_token_decimals = nat_to_decimal_precision(amount_0, token_0.decimals(), lp_token.decimals());
        let amount_1_in_lp_token_decimals = nat_to_decimal_precision(amount_1, token_1.decimals(), lp_token.decimals());
        let add_lp_token_amount = nat_sqrt(&nat_multiply(&amount_0_in_lp_token_decimals, &amount_1_in_lp_token_decimals));
        return Ok((pool, amount_0.clone(), amount_1.clone(), add_lp_token_amount));
    }

    // amount_0 * reserve_1 = amount_1 * reserve_0 for constant K
    let amount_0_reserve_1 = nat_multiply(amount_0, &reserve_1);
    let amount_1_reserve_0 = nat_multiply(amount_1, &reserve_0);
    // if the ratio of the user amounts is the same as the pool ratio, then the amounts are correct
    // rarely happens as there are rounding precision errors
    if amount_0_reserve_1 == amount_1_reserve_0 {
        // calculate the LP token amount for the user
        // add_lp_token_amount = lp_total_supply * amount_0 / reserve_0
        let amount_0_in_lp_token_decimals = nat_to_decimal_precision(amount_0, token_0.decimals(), lp_token.decimals());
        let reserve_0_in_lp_token_decimals = nat_to_decimal_precision(&reserve_0, token_0.decimals(), lp_token.decimals());
        let numerator_in_lp_token_decimals = nat_multiply(&lp_total_supply, &amount_0_in_lp_token_decimals);
        let add_lp_token_amount =
            nat_divide(&numerator_in_lp_token_decimals, &reserve_0_in_lp_token_decimals).ok_or("Invalid LP token amount")?;
        return Ok((pool, amount_0.clone(), amount_1.clone(), add_lp_token_amount));
    }

    // determine if the ratio of the user amounts is same or greater than the pool ratio (reserve_1 / reserve_0)
    // using amount_0 to calculate the amount_1 that should be added to the pool
    // amount_1 = amount_0 * reserve_1 / reserve_0
    // convert amount_0 and reserve_0 to token_1 decimal precision
    let amount_0_in_token_1_decimals = nat_to_decimal_precision(amount_0, token_0.decimals(), token_1.decimals());
    let reserve_0_in_token_1_decimals = nat_to_decimal_precision(&reserve_0, token_0.decimals(), token_1.decimals());
    // amount_0 * reserve_1 - do the multiplication first before divison to avoid loss of precision
    let numerator_in_token_1_decimals = nat_multiply(&amount_0_in_token_1_decimals, &reserve_1);
    let amount_1_in_token_1_decimals =
        nat_divide(&numerator_in_token_1_decimals, &reserve_0_in_token_1_decimals).ok_or("Invalid amount_1")?;
    // if amount_1 is equal or greater than calculated by the pool ratio, then use amount_0 and amount_1
    if *amount_1 >= amount_1_in_token_1_decimals {
        // calculate the LP token amount for the user
        // add_lp_token_amount = lp_total_supply * amount_0 / reserve_0
        let amount_0_in_lp_token_decimals = nat_to_decimal_precision(amount_0, token_0.decimals(), lp_token.decimals());
        let reserve_0_in_lp_token_decimals = nat_to_decimal_precision(&reserve_0, token_0.decimals(), lp_token.decimals());
        let numerator_in_lp_token_decimals = nat_multiply(&lp_total_supply, &amount_0_in_lp_token_decimals);
        let add_lp_token_amount =
            nat_divide(&numerator_in_lp_token_decimals, &reserve_0_in_lp_token_decimals).ok_or("Invalid LP token amount")?;
        return Ok((pool, amount_0.clone(), amount_1_in_token_1_decimals, add_lp_token_amount));
    }

    // using amount_1 to calculate the amount_0 that should be added to the pool
    // amount_0 = amount_1 * reserve_0 / reserve_1
    let amount_1_in_token_0_decimals = nat_to_decimal_precision(amount_1, token_1.decimals(), token_0.decimals());
    let reserve_1_in_token_0_decimals = nat_to_decimal_precision(&reserve_1, token_1.decimals(), token_0.decimals());
    let numerator_in_token_0_decimals = nat_multiply(&amount_1_in_token_0_decimals, &reserve_0);
    let amount_0_in_token_0_decimals =
        nat_divide(&numerator_in_token_0_decimals, &reserve_1_in_token_0_decimals).ok_or("Invalid amount_0")?;
    if *amount_0 >= amount_0_in_token_0_decimals {
        let amount_1_in_lp_token_decimals = nat_to_decimal_precision(amount_1, token_1.decimals(), lp_token.decimals());
        let reserve_1_in_lp_token_decimals = nat_to_decimal_precision(&reserve_1, token_1.decimals(), lp_token.decimals());
        let numerator_in_lp_token_decimals = nat_multiply(&lp_total_supply, &amount_1_in_lp_token_decimals);
        let add_lp_token_amount =
            nat_divide(&numerator_in_lp_token_decimals, &reserve_1_in_lp_token_decimals).ok_or("Invalid LP token amount")?;
        return Ok((pool, amount_0_in_token_0_decimals, amount_1.clone(), add_lp_token_amount));
    }

    // pool ratio must have changed from initial calculation and amount_0 and amount_1 are not enough now
    Err(format!(
        "Incorrect ratio. Required {} {} or {} {}",
        amount_0_in_token_1_decimals, symbol_0, amount_1_in_token_0_decimals, symbol_1
    ))
}

async fn process_add_liquidity(
    request_id: u64,
    user_id: u32,
    pool: &StablePool,
    add_amount_0: &Nat,
    add_amount_1: &Nat,
    ts: u64,
) -> Result<AddLiquidityReply, String> {
    // Token0
    let token_0 = pool.token_0();
    // Token1
    let token_1 = pool.token_1();

    // update the request status
    request_map::update_status(request_id, StatusCode::Start, None);

    // transfer_from token_0
    // if this fails, nothing to return so just return the error
    let token_0_transfer_id = transfer_from_token(request_id, &TokenIndex::Token0, &token_0, add_amount_0, ts).await?;

    // from this point, token_0 has been transferred to the pool. Any errors from now on will need to return token_0 back to the user
    // empty vector to store the block ids of the on-chain transfers
    let mut transfer_ids = Vec::new();
    transfer_ids.push(token_0_transfer_id);

    match transfer_from_token(request_id, &TokenIndex::Token1, &token_1, add_amount_1, ts).await {
        Ok(transfer_id) => {
            transfer_ids.push(transfer_id);
        }
        Err(e) => {
            // transfer_from token_1 failed. return token_0 back to user
            return_tokens(
                request_id,
                user_id,
                pool,
                add_amount_0, // send back the original add_amount_0
                None,         // token_1 was not transferred
                &mut transfer_ids,
                ts,
            )
            .await;
            let error = format!("AddLiq #{} failed: {}", request_id, e);
            return Err(error);
        }
    };

    // re-calculate with latest pool state
    match update_liquidity_pool(request_id, user_id, pool.pool_id, add_amount_0, add_amount_1, ts) {
        Ok((pool, amount_0, amount_1, add_lp_token_amount)) => Ok(check_balances(
            request_id,
            user_id,
            pool.pool_id,
            &amount_0,
            &amount_1,
            &add_lp_token_amount,
            &mut transfer_ids,
            ts,
        )
        .await),
        Err(e) => {
            // return token_0 and token_1 back to user
            return_tokens(
                request_id,
                user_id,
                pool,
                add_amount_0,       // send back the original add_amount_0
                Some(add_amount_1), // send back the original add_amount_1
                &mut transfer_ids,
                ts,
            )
            .await;
            let error = format!("AddLiq #{} failed: {}", request_id, e);
            Err(error)
        }
    }
}

pub async fn transfer_from_token(
    request_id: u64,
    token_index: &TokenIndex,
    token: &StableToken,
    amount: &Nat,
    ts: u64,
) -> Result<u64, String> {
    let symbol = token.symbol();
    let token_id = token.token_id();

    let caller_id = caller_id();

    match token_index {
        TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::SendToken0, None),
        TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::SendToken1, None),
    };

    match icrc2_transfer_from(token, amount, &caller_id, &kong_settings::get().kong_backend_account).await {
        Ok(block_id) => {
            // insert_transfer() will use the latest state of TRANSFER_MAP so no reentrancy issues after icrc2_transfer_from()
            // as icrc2_transfer_from() does a new transfer so block_id should be new
            let transfer_id = transfer_map::insert(&StableTransfer {
                transfer_id: 0,
                request_id,
                is_send: true,
                amount: amount.clone(),
                token_id,
                tx_id: TxId::BlockIndex(block_id),
                ts,
            });
            match token_index {
                TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::SendToken0Success, None),
                TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::SendToken1Success, None),
            };
            Ok(transfer_id)
        }
        Err(e) => {
            let error = format!("AddLiq #{} failed transfer_from user {} {}: {}", request_id, amount, symbol, e,);
            match token_index {
                TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::SendToken0Failed, Some(&e)),
                TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::SendToken1Failed, Some(&e)),
            };
            Err(error)
        }
    }
}

/// update the liquidity pool with the new liquidity amounts
/// ensure we have the latest state of the pool before adding the new amounts
fn update_liquidity_pool(
    request_id: u64,
    user_id: u32,
    pool_id: u32,
    add_amount_0: &Nat,
    add_amount_1: &Nat,
    ts: u64,
) -> Result<(StablePool, Nat, Nat, Nat), String> {
    request_map::update_status(request_id, StatusCode::CalculatePoolAmounts, None);

    // refresh pool with the latest state
    match pool_map::get_by_pool_id(pool_id) {
        Some(pool) => {
            let token_0_address_with_chain = pool.token_0().address_with_chain();
            let token_1_address_with_chain = pool.token_1().address_with_chain();
            // re-calculate the amounts to be added to the pool with new state (after token_0 and token_1 transfers)
            // add_amount_0 and add_amount_1 are the transferred amounts from the initial calculations
            // amount_0, amount_1 and add_lp_token_amount will be the actual amounts to be added to the pool
            match calculate_amounts(&token_0_address_with_chain, add_amount_0, &token_1_address_with_chain, add_amount_1) {
                Ok((pool, amount_0, amount_1, add_lp_token_amount)) => {
                    request_map::update_status(request_id, StatusCode::CalculatePoolAmountsSuccess, None);

                    request_map::update_status(request_id, StatusCode::UpdatePoolAmounts, None);
                    let update_pool = StablePool {
                        balance_0: nat_add(&pool.balance_0, &amount_0),
                        balance_1: nat_add(&pool.balance_1, &amount_1),
                        ..pool.clone()
                    };
                    pool_map::update(&update_pool);

                    request_map::update_status(request_id, StatusCode::UpdatePoolAmountsSuccess, None);

                    // update user's LP token amount
                    match update_lp_token(request_id, user_id, pool.lp_token_id, &add_lp_token_amount, ts) {
                        Ok(_) => Ok((pool, amount_0, amount_1, add_lp_token_amount)),
                        Err(e) => Err(e),
                    }
                }
                Err(e) => {
                    request_map::update_status(request_id, StatusCode::CalculatePoolAmountsFailed, Some(&e));
                    Err(e)
                }
            }
        }
        None => {
            let error = format!("AddLiq #{} failed: pool not found", request_id);
            request_map::update_status(request_id, StatusCode::CalculatePoolAmountsFailed, Some(&error));
            Err(error)
        }
    }
}

/// update the user's LP token amount
/// ensure we have the latest state of the LP token before adding the new amounts
fn update_lp_token(request_id: u64, user_id: u32, lp_token_id: u32, add_lp_token_amount: &Nat, ts: u64) -> Result<(), String> {
    request_map::update_status(request_id, StatusCode::UpdateUserLPTokenAmount, None);

    // refresh with the latest state if the entry exists
    match lp_token_map::get_by_token_id(lp_token_id) {
        Some(lp_token) => {
            // update adding the new deposit amount
            let new_user_lp_token = StableLPToken {
                amount: nat_add(&lp_token.amount, add_lp_token_amount),
                ts,
                ..lp_token.clone()
            };
            lp_token_map::update(&new_user_lp_token);
        }
        None => {
            // new entry
            let new_user_lp_token = StableLPToken::new(user_id, lp_token_id, add_lp_token_amount.clone(), ts);
            lp_token_map::insert(&new_user_lp_token);
        }
    }

    request_map::update_status(request_id, StatusCode::UpdateUserLPTokenAmountSuccess, None);

    Ok(())
}

// return and unused tokens and final balance integrity checks
// - return any extra tokens back to the user
// - any failures to return tokens back to user are saved as claims
// - check the actual balances of the canister vs. expected balances in stable memory for token_0 and token_1
// - update successful request reply
#[allow(clippy::too_many_arguments)]
async fn check_balances(
    request_id: u64,
    user_id: u32,
    pool_id: u32,
    amount_0: &Nat,
    amount_1: &Nat,
    add_lp_token_amount: &Nat,
    transfer_ids: &mut [u64],
    ts: u64,
) -> AddLiquidityReply {
    let add_liquidity_tx = AddLiquidityTx::new_success(
        pool_id,
        user_id,
        request_id,
        amount_0,
        amount_1,
        add_lp_token_amount,
        transfer_ids,
        &Vec::new(),
        ts,
    );
    // insert tx
    let tx_id = tx_map::insert(&StableTx::AddLiquidity(add_liquidity_tx.clone()));
    let reply = create_add_liquidity_reply_with_tx_id(tx_id, &add_liquidity_tx);
    request_map::update_reply(request_id, Reply::AddLiquidity(reply.clone()));
    reply
}

// failed transaction
// return any tokens back to the user
// - icrc1_transfer of token_0 and token_1 the user deposited
// - icrc2_transfer_from of token_0 and token_1 that was executed
// - any failures to return tokens back to users are saved as claims
// - update failed request reply
async fn return_tokens(
    request_id: u64,
    user_id: u32,
    pool: &StablePool,
    amount_0: &Nat,
    amount_1: Option<&Nat>,
    transfer_ids: &mut Vec<u64>,
    ts: u64,
) {
    // Token0
    let symbol_0 = pool.symbol_0();
    let token_0 = pool.token_0();
    // Token1
    let symbol_1 = pool.symbol_1();
    let token_1 = pool.token_1();

    let caller_id = caller_id();
    // claims are used to store any failed transfers back to the user
    let mut claim_ids = Vec::new();

    request_map::update_status(request_id, StatusCode::ReturnToken0, None);

    // transfer back amount_0 of token_0
    let amount_0_with_gas = nat_subtract(amount_0, &token_0.fee()).unwrap_or(nat_zero());
    match icrc1_transfer(&amount_0_with_gas, &caller_id, &token_0, None).await {
        Ok(block_id) => {
            let transfer_id = transfer_map::insert(&StableTransfer {
                transfer_id: 0,
                request_id,
                is_send: false,
                amount: amount_0_with_gas,
                token_id: token_0.token_id(),
                tx_id: TxId::BlockIndex(block_id),
                ts,
            });
            transfer_ids.push(transfer_id);
            request_map::update_status(request_id, StatusCode::ReturnToken0Success, None);
        }
        Err(e) => {
            // attempt to return token_0 failed, so save as a claim
            let claim_id = claim_map::insert(&StableClaim::new(
                user_id,
                token_0.token_id(),
                amount_0,
                Some(request_id),
                Some(Address::PrincipalId(caller_id)),
                ts,
            ));
            claim_ids.push(claim_id);
            let message = format!("{}. Saved as claim #{}", e, claim_id);
            error_log(&format!(
                "AddLiq #{} Kong failed to send {} {}: {}",
                request_id, amount_0, symbol_0, message
            ));
            request_map::update_status(request_id, StatusCode::ReturnToken0Failed, Some(&message));
        }
    }

    if let Some(amount_1) = amount_1 {
        // if token_1 was successful, then need to return token_1 back to the user
        request_map::update_status(request_id, StatusCode::ReturnToken1, None);

        // transfer back amount_1 of token_1
        let amount_1_with_gas = nat_subtract(amount_1, &token_1.fee()).unwrap_or(nat_zero());
        match icrc1_transfer(&amount_1_with_gas, &caller_id, &token_1, None).await {
            Ok(block_id) => {
                let transfer_id = transfer_map::insert(&StableTransfer {
                    transfer_id: 0,
                    request_id,
                    is_send: false,
                    amount: amount_1_with_gas,
                    token_id: token_1.token_id(),
                    tx_id: TxId::BlockIndex(block_id),
                    ts,
                });
                transfer_ids.push(transfer_id);
                request_map::update_status(request_id, StatusCode::ReturnToken1Success, None);
            }
            Err(e) => {
                let claim_id = claim_map::insert(&StableClaim::new(
                    user_id,
                    token_1.token_id(),
                    amount_1,
                    Some(request_id),
                    Some(Address::PrincipalId(caller_id)),
                    ts,
                ));
                claim_ids.push(claim_id);
                let message = format!("{}. Saved as claim #{}", e, claim_id);
                error_log(&format!(
                    "AddLiq #{} Kong failed to send {} {}: {}",
                    request_id, amount_1, symbol_1, message
                ));
                request_map::update_status(request_id, StatusCode::ReturnToken1Failed, Some(&message));
            }
        }
    }

    let reply = create_add_liquidity_reply_failed(pool.pool_id, request_id, transfer_ids, &claim_ids, ts);
    request_map::update_reply(request_id, Reply::AddLiquidity(reply));
}
