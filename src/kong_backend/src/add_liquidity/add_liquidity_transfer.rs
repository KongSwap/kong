use candid::Nat;

use super::add_liquidity::TokenIndex;
use super::add_liquidity_args::AddLiquidityArgs;
use super::add_liquidity_reply::AddLiquidityReply;
use super::add_liquidity_transfer_from::transfer_from_token;

use crate::helpers::nat_helpers::{
    nat_add, nat_divide, nat_is_zero, nat_multiply, nat_sqrt, nat_subtract, nat_to_decimal_precision, nat_zero,
};
use crate::ic::{
    address::Address, get_time::get_time, id::caller_id, logging::error_log, transfer::icrc1_transfer, verify::verify_transfer,
};
use crate::stable_claim::{claim_map, stable_claim::StableClaim};
use crate::stable_lp_token_ledger::{lp_token_ledger, stable_lp_token_ledger::StableLPTokenLedger};
use crate::stable_pool::{pool_map, stable_pool::StablePool};
use crate::stable_request::{reply::Reply, request::Request, request_map, stable_request::StableRequest, status::StatusCode};
use crate::stable_token::token_map;
use crate::stable_token::{stable_token::StableToken, token::Token};
use crate::stable_transfer::{stable_transfer::StableTransfer, transfer_map, tx_id::TxId};
use crate::stable_tx::{add_liquidity_tx::AddLiquidityTx, stable_tx::StableTx, tx_map};
use crate::stable_user::user_map;

pub async fn add_liquidity_transfer(args: AddLiquidityArgs) -> Result<AddLiquidityReply, String> {
    // user has transferred one of the tokens, we need to log the request immediately and verify the transfer
    // make sure user is registered, if not create a new user with referred_by if specified
    let user_id = user_map::insert(None)?;
    let ts = get_time();
    let request_id = request_map::insert(&StableRequest::new(user_id, &Request::AddLiquidity(args.clone()), ts));

    match check_arguments(&args, request_id, ts).await {
        Ok((token_0, tx_id_0, transfer_id_0, token_1, tx_id_1, transfer_id_1)) => {
            match process_add_liquidity(
                request_id,
                user_id,
                token_0.as_ref(),
                tx_id_0.as_ref(),
                transfer_id_0,
                token_1.as_ref(),
                tx_id_1.as_ref(),
                transfer_id_1,
                &args,
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
        Err(e) => {
            request_map::update_status(request_id, StatusCode::Failed, Some(&e));
            Err(e)
        }
    }
}

pub async fn add_liquidity_transfer_async(args: AddLiquidityArgs) -> Result<u64, String> {
    let user_id = user_map::insert(None)?;
    let ts = get_time();
    let request_id = request_map::insert(&StableRequest::new(user_id, &Request::AddLiquidity(args.clone()), ts));

    ic_cdk::spawn(async move {
        match check_arguments(&args, request_id, ts).await {
            Ok((token_0, tx_id_0, transfer_id_0, token_1, tx_id_1, transfer_id_1)) => {
                match process_add_liquidity(
                    request_id,
                    user_id,
                    token_0.as_ref(),
                    tx_id_0.as_ref(),
                    transfer_id_0,
                    token_1.as_ref(),
                    tx_id_1.as_ref(),
                    transfer_id_1,
                    &args,
                    ts,
                )
                .await
                {
                    Ok(_) => request_map::update_status(request_id, StatusCode::Success, None),
                    Err(e) => request_map::update_status(request_id, StatusCode::Failed, Some(&e)),
                }
            }
            Err(e) => request_map::update_status(request_id, StatusCode::Failed, Some(&e)),
        };
    });

    Ok(request_id)
}

/// if any of the transfer is valid, then must proceed as we mayb need to return the token back to the user
async fn check_arguments(
    args: &AddLiquidityArgs,
    request_id: u64,
    ts: u64,
) -> Result<
    (
        Option<StableToken>,
        Option<Nat>,
        Result<u64, String>,
        Option<StableToken>,
        Option<Nat>,
        Result<u64, String>,
    ),
    String,
> {
    // update the request status
    request_map::update_status(request_id, StatusCode::Start, None);

    // check token_0. If token_0 is not valid, we still need to continue as we may need to return token_1 to the user
    let token_0 = match token_map::get_by_token(&args.token_0) {
        Ok(token) => Some(token),
        Err(e) => {
            request_map::update_status(request_id, StatusCode::Token0NotFound, Some(&e));
            None
        }
    };

    // check token_1
    let token_1 = match token_map::get_by_token(&args.token_1) {
        Ok(token) => Some(token),
        Err(e) => {
            request_map::update_status(request_id, StatusCode::Token1NotFound, Some(&e));
            None
        }
    };

    // either token_0 and token_1 must be valid token
    if token_0.is_none() && token_1.is_none() {
        return Err("Token_0 or Token_1 is required".to_string());
    }

    // check tx_id_0 is valid block index Nat
    let tx_id_0 = match &args.tx_id_0 {
        Some(TxId::BlockIndex(tx_id)) => Some(tx_id.clone()),
        _ => None,
    };

    let tx_id_1 = match &args.tx_id_1 {
        Some(TxId::BlockIndex(tx_id)) => Some(tx_id.clone()),
        _ => None,
    };

    // either tx_id_0 or tx_id_1 must be valid
    if tx_id_0.is_none() && tx_id_1.is_none() {
        return Err("Tx_id_0 or Tx_id_1 is required".to_string());
    }

    // transfer_id_0 is used to store if the transfer was successful
    let transfer_id_0 = match tx_id_0.clone() {
        Some(tx_id) if token_0.is_some() => {
            let token_index = TokenIndex::Token0;
            let amount = &args.amount_0;
            let token = token_0.clone().unwrap();
            match verify_transfer_token(request_id, &token_index, &token, &tx_id, amount, ts).await {
                Ok(transfer_id) => Ok(transfer_id),
                Err(e) => Err(e),
            }
        }
        _ => Err("Unable to verify transfer_0".to_string()),
    };

    let transfer_id_1 = match tx_id_1.clone() {
        Some(tx_id) if token_1.is_some() => {
            let token_index = TokenIndex::Token1;
            let amount = &args.amount_1;
            let token = token_1.clone().unwrap();
            match verify_transfer_token(request_id, &token_index, &token, &tx_id, amount, ts).await {
                Ok(transfer_id) => Ok(transfer_id),
                Err(e) => Err(e),
            }
        }
        _ => Err("Unable to verify transfer_1".to_string()),
    };

    // one of the transfers must be successful
    if transfer_id_0.is_err() && transfer_id_1.is_err() {
        return Err("Failed to verify transfers".to_string());
    }

    Ok((token_0, tx_id_0, transfer_id_0, token_1, tx_id_1, transfer_id_1))
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
    let lp_total_supply = lp_token_ledger::get_total_supply(lp_token_id);

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

#[allow(clippy::too_many_arguments)]
async fn process_add_liquidity(
    request_id: u64,
    user_id: u32,
    token_0: Option<&StableToken>,
    tx_id_0: Option<&Nat>,
    transfer_id_0: Result<u64, String>,
    token_1: Option<&StableToken>,
    tx_id_1: Option<&Nat>,
    transfer_id_1: Result<u64, String>,
    args: &AddLiquidityArgs,
    ts: u64,
) -> Result<AddLiquidityReply, String> {
    let add_amount_0 = args.amount_0.clone();
    let add_amount_1 = args.amount_1.clone();

    // empty vector to store the block ids of the on-chain transfers
    let mut transfer_ids = Vec::new();

    let mut transfer_0 = match transfer_id_0 {
        Ok(transfer_id) => {
            // user issued an icrc1_transfer and has been verified in check_arguments()
            transfer_ids.push(transfer_id);
            Ok(())
        }
        // either icrc1_transfer could not be verified (transfer_id_0.is_err()) or must be an icrc2_transfer_from (tx_id_0.is_none())
        // which is handled a bit later on
        Err(e) => Err(e),
    };

    let mut transfer_1 = match transfer_id_1 {
        Ok(transfer_id) => {
            // user issued an icrc1_transfer and has been verified in check_arguments()
            transfer_ids.push(transfer_id);
            Ok(())
        }
        Err(e) => Err(e),
    };

    let pool_id = if token_0.is_some() && token_1.is_some() {
        let token_0 = token_0.unwrap();
        let token_id_0 = token_0.token_id();
        let token_1 = token_1.unwrap();
        let token_id_1 = token_1.token_id();
        match pool_map::get_by_token_ids(token_id_0, token_id_1) {
            Some(pool) => {
                // now that we know the pool exists, if transfer_0.is_err() and tx_id.is_none() then it's an icrc2_transfer_from
                if transfer_0.is_err() && tx_id_0.is_none() {
                    transfer_0 = match transfer_from_token(request_id, &TokenIndex::Token0, token_0, &add_amount_0, ts).await {
                        Ok(transfer_id) => {
                            transfer_ids.push(transfer_id);
                            Ok(())
                        }
                        Err(e) => Err(e),
                    }
                }
                // only icrc2_transfer_from token 1 if transfer_0 was successful
                if transfer_0.is_ok() && transfer_1.is_err() && tx_id_1.is_none() {
                    transfer_1 = match transfer_from_token(request_id, &TokenIndex::Token1, token_1, &add_amount_1, ts).await {
                        Ok(transfer_id) => {
                            transfer_ids.push(transfer_id);
                            Ok(())
                        }
                        Err(e) => Err(e),
                    }
                }
                Some(pool.pool_id)
            }
            None => {
                request_map::update_status(request_id, StatusCode::PoolNotFound, None);
                None
            }
        }
    } else {
        request_map::update_status(request_id, StatusCode::PoolNotFound, None);
        None
    };

    // pool must exist and both transfers must be successful
    if pool_id.is_none() || transfer_0.is_err() || transfer_1.is_err() {
        return_tokens(
            request_id,
            user_id,
            pool_id,
            token_0,
            &transfer_0,
            &add_amount_0,
            token_1,
            &transfer_1,
            &add_amount_1,
            &mut transfer_ids,
            ts,
        )
        .await;
        let error = match transfer_0 {
            Ok(_) => match transfer_1 {
                Err(e) => format!("AddLiq #{} failed to transfer token 1: {}", request_id, e),
                _ => format!("AddLiq #{} failed to transfer", request_id),
            },
            Err(e) => format!("AddLiq #{} failed to transfer token 0: {}", request_id, e),
        };
        return Err(error);
    }

    // update liqudity pool with new added amounts
    match update_liquidity_pool(request_id, user_id, pool_id.unwrap(), &add_amount_0, &add_amount_1, ts) {
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
            return_tokens(
                request_id,
                user_id,
                pool_id,
                token_0,
                &transfer_0,
                &add_amount_0,
                token_1,
                &transfer_1,
                &add_amount_1,
                &mut transfer_ids,
                ts,
            )
            .await;
            let error = format!("AddLiq #{} failed to update pool: {}", request_id, e);
            Err(error)
        }
    }
}

async fn verify_transfer_token(
    request_id: u64,
    token_index: &TokenIndex,
    token: &StableToken,
    tx_id: &Nat,
    amount: &Nat,
    ts: u64,
) -> Result<u64, String> {
    let symbol = token.symbol();
    let token_id = token.token_id();

    match token_index {
        TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::VerifyToken0, None),
        TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::VerifyToken1, None),
    };

    // verify the transfer
    match verify_transfer(token, tx_id, amount).await {
        Ok(_) => {
            // contain() will use the latest state of TRANSFER_MAP to prevent reentrancy issues after verify_transfer()
            if transfer_map::contain(token_id, tx_id) {
                let error = format!(
                    "AddLiq #{} failed to verify tx {} #{}: duplicate block id",
                    request_id, symbol, tx_id
                );
                match token_index {
                    TokenIndex::Token0 => {
                        request_map::update_status(request_id, StatusCode::VerifyToken0Failed, Some("Duplicate block id"))
                    }
                    TokenIndex::Token1 => {
                        request_map::update_status(request_id, StatusCode::VerifyToken1Failed, Some("Duplicate block id"))
                    }
                };
                return Err(error);
            }
            let transfer_id = transfer_map::insert(&StableTransfer {
                transfer_id: 0,
                request_id,
                is_send: true,
                amount: amount.clone(),
                token_id,
                tx_id: TxId::BlockIndex(tx_id.clone()),
                ts,
            });
            match token_index {
                TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::VerifyToken0Success, None),
                TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::VerifyToken1Success, None),
            };
            Ok(transfer_id)
        }
        Err(e) => {
            let error = format!("AddLiq #{} failed to verify tx {} #{}: {}", request_id, symbol, tx_id, e);
            match token_index {
                TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::VerifyToken0Failed, Some(&e)),
                TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::VerifyToken1Failed, Some(&e)),
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
    match lp_token_ledger::get_by_token_id(lp_token_id) {
        Some(lp_token) => {
            // update adding the new deposit amount
            let new_user_lp_token = StableLPTokenLedger {
                amount: nat_add(&lp_token.amount, add_lp_token_amount),
                ts,
                ..lp_token.clone()
            };
            lp_token_ledger::update(&new_user_lp_token);
        }
        None => {
            // new entry
            let new_user_lp_token = StableLPTokenLedger::new(user_id, lp_token_id, add_lp_token_amount.clone(), ts);
            lp_token_ledger::insert(&new_user_lp_token);
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
    // need to pass in the tx_id to the reply
    let reply = AddLiquidityReply::new_with_tx_id(tx_id, &add_liquidity_tx);
    request_map::update_reply(request_id, Reply::AddLiquidity(reply.clone()));
    reply
}

// failed transaction
// return any tokens back to the user
// - icrc1_transfer of token_0 and token_1 the user deposited
// - icrc2_transfer_from of token_0 and token_1 that was executed
// - any failures to return tokens back to users are saved as claims
// - update failed request reply
#[allow(clippy::too_many_arguments)]
async fn return_tokens(
    request_id: u64,
    user_id: u32,
    pool_id: Option<u32>,
    token_0: Option<&StableToken>,
    transfer_0: &Result<(), String>,
    amount_0: &Nat,
    token_1: Option<&StableToken>,
    transfer_1: &Result<(), String>,
    amount_1: &Nat,
    transfer_ids: &mut Vec<u64>,
    ts: u64,
) {
    let caller_id = caller_id();
    // claims are used to store any failed transfers back to the user
    let mut claim_ids = Vec::new();

    // make sure token is valid and transfer was verified. If so, then return the token back to the user
    if token_0.is_some() && transfer_0.is_ok() {
        request_map::update_status(request_id, StatusCode::ReturnToken0, None);

        let token_0 = token_0.unwrap();
        let token_id_0 = token_0.token_id();
        let symbol_0 = token_0.symbol();
        let fee_0 = token_0.fee();

        let amount_0_with_gas = nat_subtract(amount_0, &fee_0).unwrap_or(nat_zero());
        match icrc1_transfer(&amount_0_with_gas, &caller_id, token_0, None).await {
            Ok(block_id) => {
                let transfer_id = transfer_map::insert(&StableTransfer {
                    transfer_id: 0,
                    request_id,
                    is_send: false,
                    amount: amount_0_with_gas,
                    token_id: token_id_0,
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
                    token_id_0,
                    amount_0,
                    Some(request_id),
                    Some(Address::PrincipalId(caller_id)),
                    ts,
                ));
                claim_ids.push(claim_id);
                let message = format!("{}. Saved as claim #{}", e, claim_id);
                error_log(&format!(
                    "AddLiq #{} Kong failed to return {} {}: {}",
                    request_id, amount_0, symbol_0, message
                ));
                request_map::update_status(request_id, StatusCode::ReturnToken0Failed, Some(&message));
            }
        }
    }

    if token_1.is_some() && transfer_1.is_ok() {
        request_map::update_status(request_id, StatusCode::ReturnToken1, None);

        let token_1 = token_1.unwrap();
        let token_id_1 = token_1.token_id();
        let symbol_1 = token_1.symbol();
        let fee_1 = token_1.fee();

        let amount_1_with_gas = nat_subtract(amount_1, &fee_1).unwrap_or(nat_zero());
        match icrc1_transfer(&amount_1_with_gas, &caller_id, token_1, None).await {
            Ok(block_id) => {
                let transfer_id = transfer_map::insert(&StableTransfer {
                    transfer_id: 0,
                    request_id,
                    is_send: false,
                    amount: amount_1_with_gas,
                    token_id: token_id_1,
                    tx_id: TxId::BlockIndex(block_id),
                    ts,
                });
                transfer_ids.push(transfer_id);
                request_map::update_status(request_id, StatusCode::ReturnToken1Success, None);
            }
            Err(e) => {
                let claim_id = claim_map::insert(&StableClaim::new(
                    user_id,
                    token_id_1,
                    amount_1,
                    Some(request_id),
                    Some(Address::PrincipalId(caller_id)),
                    ts,
                ));
                claim_ids.push(claim_id);
                let message = format!("{}. Saved as claim #{}", e, claim_id);
                error_log(&format!(
                    "AddLiq #{} Kong failed to return {} {}: {}",
                    request_id, amount_1, symbol_1, message
                ));
                request_map::update_status(request_id, StatusCode::ReturnToken1Failed, Some(&message));
            }
        }
    }

    let pool_id = pool_id.unwrap_or(0);
    let reply = AddLiquidityReply::new_failed(pool_id, request_id, transfer_ids, &claim_ids, ts);
    request_map::update_reply(request_id, Reply::AddLiquidity(reply));
}
