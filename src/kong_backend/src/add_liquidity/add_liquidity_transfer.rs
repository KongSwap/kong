use candid::Nat;
use icrc_ledger_types::icrc1::account::Account;

use super::add_liquidity::TokenIndex;
use super::add_liquidity_args::AddLiquidityArgs;
use super::add_liquidity_reply::AddLiquidityReply;
use super::add_liquidity_reply_helpers::{create_add_liquidity_reply_failed, create_add_liquidity_reply_with_tx_id};
use super::add_liquidity_transfer_from::{transfer_from_token, update_liquidity_pool};

use crate::helpers::nat_helpers::{nat_subtract, nat_zero};
use crate::ic::{address::Address, get_time::get_time, id::caller_id, transfer::icrc1_transfer, verify::verify_transfer};
use crate::stable_claim::{claim_map, stable_claim::StableClaim};
use crate::stable_kong_settings::kong_settings_map;
use crate::stable_pool::pool_map;
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

    let caller_id = caller_id();
    let kong_backend = kong_settings_map::get().kong_backend_account;

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

    let pool = if token_0.is_some() && token_1.is_some() {
        let tok_0 = token_0.unwrap();
        let tok_id_0 = tok_0.token_id();
        let tok_1 = token_1.unwrap();
        let tok_id_1 = tok_1.token_id();
        match pool_map::get_by_token_ids(tok_id_0, tok_id_1) {
            Some(pool) => {
                // now that we know the pool exists, if transfer_0.is_err() and tx_id.is_none() then it's an icrc2_transfer_from
                if transfer_0.is_err() && tx_id_0.is_none() {
                    transfer_0 =
                        match transfer_from_token(request_id, &caller_id, &TokenIndex::Token0, tok_0, &add_amount_0, &kong_backend, ts)
                            .await
                        {
                            Ok(transfer_id) => {
                                transfer_ids.push(transfer_id);
                                Ok(())
                            }
                            Err(e) => Err(e),
                        }
                }

                // only icrc2_transfer_from token 1 if transfer_0 was successful
                if transfer_0.is_ok() && transfer_1.is_err() && tx_id_1.is_none() {
                    transfer_1 =
                        match transfer_from_token(request_id, &caller_id, &TokenIndex::Token1, tok_1, &add_amount_1, &kong_backend, ts)
                            .await
                        {
                            Ok(transfer_id) => {
                                transfer_ids.push(transfer_id);
                                Ok(())
                            }
                            Err(e) => Err(e),
                        }
                }
                pool
            }
            None => {
                request_map::update_status(request_id, StatusCode::PoolNotFound, None);
                return_tokens(
                    request_id,
                    user_id,
                    &caller_id,
                    None,
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
                return Err(format!("AddLiq #{} failed. Pool not found", request_id));
            }
        }
    } else {
        request_map::update_status(request_id, StatusCode::PoolNotFound, None);
        return_tokens(
            request_id,
            user_id,
            &caller_id,
            None,
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
        return Err(format!("AddLiq #{} failed. Pool not found", request_id));
    };

    // both transfers must be successful
    if transfer_0.is_err() || transfer_1.is_err() {
        return_tokens(
            request_id,
            user_id,
            &caller_id,
            Some(pool.pool_id),
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
        return Err(if transfer_0.is_err() {
            format!("AddLiq #{} failed. {}", request_id, transfer_0.unwrap_err())
        } else {
            format!("AddLiq #{} failed. {}", request_id, transfer_1.unwrap_err())
        });
    }

    // re-calculate with latest pool state and make sure amounts are valid
    let (pool, amount_0, amount_1, add_lp_token_amount) =
        match update_liquidity_pool(request_id, user_id, &pool, &add_amount_0, &add_amount_1, ts) {
            Ok((pool, amount_0, amount_1, add_lp_token_amount)) => (pool, amount_0, amount_1, add_lp_token_amount),
            Err(e) => {
                // LP amounts are incorrect. return token_0 and token_1 back to user
                return_tokens(
                    request_id,
                    user_id,
                    &caller_id,
                    Some(pool.pool_id),
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
                return Err(format!("AddLiq #{} failed: {}", request_id, e));
            }
        };

    // successful, add tx and update request with reply
    let add_liquidity_tx = AddLiquidityTx::new_success(
        pool.pool_id,
        user_id,
        request_id,
        &amount_0,
        &amount_1,
        &add_lp_token_amount,
        &transfer_ids,
        &Vec::new(),
        ts,
    );
    let tx_id = tx_map::insert(&StableTx::AddLiquidity(add_liquidity_tx.clone()));
    let reply = create_add_liquidity_reply_with_tx_id(tx_id, &add_liquidity_tx);
    request_map::update_reply(request_id, Reply::AddLiquidity(reply.clone()));

    Ok(reply)
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
                    "AddLiq #{} failed to verify tx_id #{} {}. Duplicate block id",
                    request_id, tx_id, symbol
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
            let error = format!("AddLiq #{} failed to verify tx_id #{} {}. {}", request_id, tx_id, symbol, e);
            match token_index {
                TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::VerifyToken0Failed, Some(&e)),
                TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::VerifyToken1Failed, Some(&e)),
            };
            Err(error)
        }
    }
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
    to_principal_id: &Account,
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
    let mut claim_ids = Vec::new();

    // make sure token is valid and transfer was verified. If so, then return the token back to the user
    if token_0.is_some() && transfer_0.is_ok() {
        request_map::update_status(request_id, StatusCode::ReturnToken0, None);

        let token_0 = token_0.unwrap();
        let token_id_0 = token_0.token_id();
        let fee_0 = token_0.fee();

        let amount_0_with_gas = nat_subtract(amount_0, &fee_0).unwrap_or(nat_zero());
        match icrc1_transfer(&amount_0_with_gas, to_principal_id, token_0, None).await {
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
                let message = match claim_map::insert(&StableClaim::new(
                    user_id,
                    token_id_0,
                    amount_0,
                    Some(request_id),
                    Some(Address::PrincipalId(*to_principal_id)),
                    ts,
                )) {
                    Ok(claim_id) => {
                        claim_ids.push(claim_id);
                        format!("Saved as claim #{}. {}", claim_id, e)
                    }
                    Err(e) => format!("Failed to save claim: {}", e),
                };
                request_map::update_status(request_id, StatusCode::ReturnToken0Failed, Some(&message));
            }
        }
    }

    if token_1.is_some() && transfer_1.is_ok() {
        request_map::update_status(request_id, StatusCode::ReturnToken1, None);

        let token_1 = token_1.unwrap();
        let token_id_1 = token_1.token_id();
        let fee_1 = token_1.fee();

        let amount_1_with_gas = nat_subtract(amount_1, &fee_1).unwrap_or(nat_zero());
        match icrc1_transfer(&amount_1_with_gas, to_principal_id, token_1, None).await {
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
                let message = match claim_map::insert(&StableClaim::new(
                    user_id,
                    token_id_1,
                    amount_1,
                    Some(request_id),
                    Some(Address::PrincipalId(*to_principal_id)),
                    ts,
                )) {
                    Ok(claim_id) => {
                        claim_ids.push(claim_id);
                        format!("Saved as claim #{}. {}", claim_id, e)
                    }
                    Err(e) => format!("Failed to save claim. {}", e),
                };
                request_map::update_status(request_id, StatusCode::ReturnToken1Failed, Some(&message));
            }
        }
    }

    let pool_id = pool_id.unwrap_or(0);
    let reply = create_add_liquidity_reply_failed(pool_id, request_id, transfer_ids, &claim_ids, ts);
    request_map::update_reply(request_id, Reply::AddLiquidity(reply));

    // archive claims to kong_data
    for claim_id in claim_ids {
        claim_map::archive_claim_to_kong_data(claim_id);
    }
}
