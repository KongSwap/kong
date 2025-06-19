use candid::Nat;
use ic_cdk::update;
use icrc_ledger_types::icrc1::account::Account;

use super::add_pool_args::AddPoolArgs;
use super::add_pool_reply::AddPoolReply;
use super::add_pool_reply_helpers::{to_add_pool_reply, to_add_pool_reply_failed};

use crate::add_token::add_token::{add_ic_token, add_lp_token, add_solana_token};
use crate::add_token::add_token_args::AddTokenArgs;
use crate::chains::chains::{IC_CHAIN, SOL_CHAIN};
use crate::helpers::nat_helpers::{nat_add, nat_is_zero, nat_multiply, nat_sqrt, nat_subtract, nat_to_decimal_precision, nat_zero};
use crate::ic::{
    address::Address,
    ckusdt::is_ckusdt,
    guards::not_in_maintenance_mode,
    icp::is_icp,
    network::ICNetwork,
    transfer::{icrc1_transfer, icrc2_transfer_from},
    verify_transfer::verify_transfer,
};
use crate::stable_claim::{claim_map, stable_claim::StableClaim};
use crate::stable_kong_settings::kong_settings_map;
use crate::stable_lp_token::lp_token_map;
use crate::stable_lp_token::stable_lp_token::StableLPToken;
use crate::stable_pool::pool_map;
use crate::stable_pool::stable_pool::StablePool;
use crate::stable_request::{reply::Reply, request::Request, request_map, stable_request::StableRequest, status::StatusCode};
use crate::stable_token::lp_token::LP_DECIMALS;
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::token;
use crate::stable_token::token::Token;
use crate::stable_token::token_map;
use crate::stable_transfer::stable_transfer::StableTransfer;
use crate::stable_transfer::transfer_map;
use crate::stable_transfer::tx_id::TxId;
use crate::stable_tx::{add_pool_tx::AddPoolTx, stable_tx::StableTx, tx_map};
use crate::stable_user::user_map;
use crate::swap::create_solana_swap_job::create_solana_swap_job;

use super::pool_payment_verifier::{PoolPaymentVerifier, PoolPaymentVerification};

enum TokenIndex {
    Token0,
    Token1,
}

/// Adds a pool to Kong
///
/// # Arguments
///
/// * `args` - The arguments for adding a pool.
///
/// # Returns
///
/// * `Ok(String)` - A success message if the pool is added successfully.
/// * `Err(String)` - An error message if the operation fails.
#[update(guard = "not_in_maintenance_mode")]
pub async fn add_pool(args: AddPoolArgs) -> Result<AddPoolReply, String> {
    let args_clone = args.clone();
    let (user_id, token_0, add_amount_0, tx_id_0, token_1, add_amount_1, tx_id_1, lp_fee_bps, kong_fee_bps, add_lp_token_amount) =
        check_arguments(&args).await?;
    let ts = ICNetwork::get_time();
    let request_id = request_map::insert(&StableRequest::new(user_id, &Request::AddPool(args_clone), ts));

    let result = match process_add_pool(
        request_id,
        user_id,
        &token_0,
        &add_amount_0,
        tx_id_0.as_ref(),
        &token_1,
        &add_amount_1,
        tx_id_1.as_ref(),
        lp_fee_bps,
        kong_fee_bps,
        &add_lp_token_amount,
        ts,
        &args,
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

/// Check the arguments are valid, create new token_0 if it does not exist and calculate the amounts to be added to the pool
///
/// # Arguments
///
/// * `args` - The arguments for adding a pool.
///
/// # Returns
///
/// * `Ok((user_id, token_0, amount_0, tx_id_0, token_1, add_amount_1, tx_id_1, lp_fee_bps))`
/// *   `user_id` - The user id.
/// *   `token_0` - The first token.
/// *   `amount_0` - The amount of the first token.
/// *   `tx_id_0` - The transaction id of the first token for icrc1_transfer.
/// *   `token_1` - The second token.
/// *   `add_amount_1` - The amount of the second token.
/// *   `tx_id_1` - The transaction id of the second token for icrc1_transfer.
/// *   `lp_fee_bps` - The liquidity pool fee basis points.
/// *   `kong_fee_bps` - The liquidity pool Kong fee basis points.
/// *   `add_lp_token_amount` - The amount of LP token to be added to the pool.
/// * `Err(String)` - An error message if the operation fails.
async fn check_arguments(
    args: &AddPoolArgs,
) -> Result<(u32, StableToken, Nat, Option<Nat>, StableToken, Nat, Option<Nat>, u8, u8, Nat), String> {
    if nat_is_zero(&args.amount_0) || nat_is_zero(&args.amount_1) {
        Err("Invalid zero amounts".to_string())?
    }

    // Check if either token is a Solana token
    let has_solana_token = token_map::get_chain(&args.token_0)
        .map(|chain| chain == SOL_CHAIN)
        .unwrap_or(false) || 
        token_map::get_chain(&args.token_1)
        .map(|chain| chain == SOL_CHAIN)
        .unwrap_or(false);

    let lp_fee_bps = match args.lp_fee_bps {
        Some(lp_fee_bps) => lp_fee_bps,
        None => {
            if has_solana_token {
                100 // 1% fee for pools with Solana tokens
            } else {
                kong_settings_map::get().default_lp_fee_bps // Default 0.3% for IC-only pools
            }
        }
    };

    let default_kong_fee_bps = kong_settings_map::get().default_kong_fee_bps;
    let kong_fee_bps = default_kong_fee_bps;
    if lp_fee_bps < kong_fee_bps {
        Err(format!("LP fee cannot be less than Kong fee of {}", kong_fee_bps))?
    }

    // Extract the block indices for IC tokens only
    // For cross-chain tokens with TransactionId, we'll use the original args.tx_id_0/1 in verify_cross_chain_transfer
    let tx_id_0 = match &args.tx_id_0 {
        Some(TxId::BlockIndex(block_id)) => Some(block_id.clone()),
        Some(TxId::TransactionId(_)) => None, // Cross-chain tx will use args.tx_id_0 directly
        None => None,
    };
    let tx_id_1 = match &args.tx_id_1 {
        Some(TxId::BlockIndex(block_id)) => Some(block_id.clone()),
        Some(TxId::TransactionId(_)) => None, // Cross-chain tx will use args.tx_id_1 directly
        None => None,
    };

    // make sure token_1 is ckUSDT or ICP
    let token_1 = match args.token_1.as_str() {
        token if is_ckusdt(token) => token_map::get_ckusdt()?,
        token if is_icp(token) => token_map::get_icp()?,
        _ => Err(format!(
            "Token_1 must be {} or {}",
            kong_settings_map::get().ckusdt_symbol,
            kong_settings_map::get().icp_symbol
        ))?,
    };

    // token_0, check if it exists already or needs to be added
    // leave token_0 check latest as possible as token will be added to the system
    let token_0 = match token_map::get_by_token(&args.token_0) {
        Ok(token) => token, // token_0 exists already
        Err(_) => {
            // token_0 needs to be added. Support IC and Solana tokens
            match token_map::get_chain(&args.token_0) {
                Some(chain) if chain == IC_CHAIN => add_ic_token(&args.token_0).await?,
                Some(chain) if chain == SOL_CHAIN => {
                    // For Solana tokens, create AddTokenArgs with default values
                    let add_token_args = AddTokenArgs {
                        token: args.token_0.clone(),
                        name: None,
                        symbol: None,
                        decimals: None,
                        fee: None,
                        program_id: None,
                        total_supply: None,
                    };
                    add_solana_token(&add_token_args).await?
                }
                Some(_) | None => Err("Token_0 chain not supported")?,
            }
        }
    };

    // make sure LP token does not already exist
    let lp_token_address = token::address(&token_0, &token_1);
    if token_map::exists(&lp_token_address) {
        Err(format!("LP token {} already exists", token::symbol(&token_0, &token_1)))?
    }

    // make sure pool does not already exist
    if pool_map::exists(&token_0, &token_1) {
        Err(format!("Pool {} already exists", pool_map::symbol(&token_0, &token_1)))?
    }

    let (add_amount_0, add_amount_1, add_lp_token_amount) = calculate_amounts(&token_0, &args.amount_0, &token_1, &args.amount_1)?;

    // make sure user is registered, if not create a new user
    let user_id = user_map::insert(None)?;

    Ok((
        user_id,
        token_0,
        add_amount_0,
        tx_id_0,
        token_1,
        add_amount_1,
        tx_id_1,
        lp_fee_bps,
        kong_fee_bps,
        add_lp_token_amount,
    ))
}

pub fn calculate_amounts(token_0: &StableToken, amount_0: &Nat, token_1: &StableToken, amount_1: &Nat) -> Result<(Nat, Nat, Nat), String> {
    // new pool as there are no balances - take user amounts as initial ratio
    // initialize LP tokens as sqrt(amount_0 * amount_1)
    // convert the amounts to the same decimal precision as the LP token
    let amount_0_in_lp_token_decimals = nat_to_decimal_precision(amount_0, token_0.decimals(), LP_DECIMALS);
    let amount_1_in_lp_token_decimals = nat_to_decimal_precision(amount_1, token_1.decimals(), LP_DECIMALS);
    let add_lp_token_amount = nat_sqrt(&nat_multiply(&amount_0_in_lp_token_decimals, &amount_1_in_lp_token_decimals));

    Ok((amount_0.clone(), amount_1.clone(), add_lp_token_amount))
}

#[allow(clippy::too_many_arguments)]
async fn process_add_pool(
    request_id: u64,
    user_id: u32,
    token_0: &StableToken,
    amount_0: &Nat,
    tx_id_0: Option<&Nat>,
    token_1: &StableToken,
    amount_1: &Nat,
    tx_id_1: Option<&Nat>,
    lp_fee_bps: u8,
    kong_fee_bps: u8,
    add_lp_token_amount: &Nat,
    ts: u64,
    args: &AddPoolArgs,
) -> Result<AddPoolReply, String> {
    let caller_id = ICNetwork::caller_id();
    let kong_backend = kong_settings_map::get().kong_backend;
    let mut transfer_ids = Vec::new();

    request_map::update_status(request_id, StatusCode::Start, None);

    // Check if this is a cross-chain transfer based on signature presence
    let transfer_0 = if args.signature_0.is_some() {
        // Cross-chain payment path - use payment verifier
        ic_cdk::println!("DEBUG: Entering cross-chain path for token_0 with signature: {:?}", args.signature_0);
        ic_cdk::println!("DEBUG: tx_id_0 from args: {:?}", args.tx_id_0);
        verify_cross_chain_transfer(
            request_id,
            &TokenIndex::Token0,
            token_0,
            amount_0,
            args.signature_0.as_ref().unwrap(),
            &args.tx_id_0,
            args.timestamp,
            &mut transfer_ids,
            ts,
            args,
        ).await
    } else {
        // IC-only path (backward compatible)
        match tx_id_0 {
            Some(block_id) => verify_transfer_token(request_id, &TokenIndex::Token0, token_0, block_id, amount_0, &mut transfer_ids, ts).await,
            None => {
                transfer_from_token(
                    request_id,
                    &caller_id,
                    &TokenIndex::Token0,
                    token_0,
                    amount_0,
                    &kong_backend,
                    &mut transfer_ids,
                    ts,
                )
                .await
            }
        }
    };

    let transfer_1 = if args.signature_1.is_some() {
        // Cross-chain payment path - use payment verifier
        verify_cross_chain_transfer(
            request_id,
            &TokenIndex::Token1,
            token_1,
            amount_1,
            args.signature_1.as_ref().unwrap(),
            &args.tx_id_1,
            args.timestamp,
            &mut transfer_ids,
            ts,
            args,
        ).await
    } else {
        // IC-only path (backward compatible)
        match tx_id_1 {
            Some(block_id) => verify_transfer_token(request_id, &TokenIndex::Token1, token_1, block_id, amount_1, &mut transfer_ids, ts).await,
            None => {
                //  if transfer_token_0 failed, no need to icrc2_transfer_from token_1
                if transfer_0.is_err() {
                    Err("Token_0 transfer failed".to_string())
                } else {
                    transfer_from_token(
                        request_id,
                        &caller_id,
                        &TokenIndex::Token1,
                        token_1,
                        amount_1,
                        &kong_backend,
                        &mut transfer_ids,
                        ts,
                    )
                    .await
                }
            }
        }
    };

    // both transfers must be successful
    if transfer_0.is_err() || transfer_1.is_err() {
        return_tokens(
            request_id,
            user_id,
            &caller_id,
            &transfer_0,
            token_0,
            amount_0,
            &transfer_1,
            token_1,
            amount_1,
            &mut transfer_ids,
            ts,
        )
        .await;
        if transfer_0.is_err() {
            return Err(format!("Req #{} failed. {}", request_id, transfer_0.unwrap_err()));
        } else {
            return Err(format!("Req #{} failed. {}", request_id, transfer_1.unwrap_err()));
        };
    }

    // add LP token
    request_map::update_status(request_id, StatusCode::AddLPToken, None);
    // default to None for LP token metadata
    let lp_token = match add_lp_token(token_0, token_1) {
        Ok(lp_token) => {
            request_map::update_status(request_id, StatusCode::AddLPTokenSuccess, None);
            lp_token
        }
        Err(e) => {
            request_map::update_status(request_id, StatusCode::AddLPTokenFailed, Some(&e));
            return_tokens(
                request_id,
                user_id,
                &caller_id,
                &transfer_0,
                token_0,
                amount_0,
                &transfer_1,
                token_1,
                amount_1,
                &mut transfer_ids,
                ts,
            )
            .await;
            Err(format!("Req #{} failed. {}", request_id, e))?
        }
    };

    // add pool
    request_map::update_status(request_id, StatusCode::AddPool, None);
    let pool = match add_new_pool(
        token_0.token_id(),
        token_1.token_id(),
        lp_fee_bps,
        kong_fee_bps,
        lp_token.token_id(),
    ) {
        Ok(pool) => {
            request_map::update_status(request_id, StatusCode::AddPoolSuccess, None);
            pool
        }
        Err(e) => {
            request_map::update_status(request_id, StatusCode::AddPoolFailed, Some(&e));
            return_tokens(
                request_id,
                user_id,
                &caller_id,
                &transfer_0,
                token_0,
                amount_0,
                &transfer_1,
                token_1,
                amount_1,
                &mut transfer_ids,
                ts,
            )
            .await;
            Err(format!("Req #{} failed. {}", request_id, e))?
        }
    };

    // update pool with new balances
    update_liquidity_pool(request_id, user_id, &pool, amount_0, amount_1, add_lp_token_amount, ts);

    // successful, add tx and update request with reply
    let add_pool_tx = AddPoolTx::new_success(
        pool.pool_id,
        user_id,
        request_id,
        amount_0,
        amount_1,
        add_lp_token_amount,
        &transfer_ids,
        &Vec::new(),
        ts,
    );
    let tx_id = tx_map::insert(&StableTx::AddPool(add_pool_tx.clone()));
    let reply = match tx_map::get_by_user_and_token_id(Some(tx_id), None, None, None).first() {
        Some(StableTx::AddPool(add_pool_tx)) => to_add_pool_reply(add_pool_tx),
        _ => to_add_pool_reply_failed(
            request_id,
            &token_0.chain(),
            &token_0.address(),
            &token_0.symbol(),
            &token_1.chain(),
            &token_1.address(),
            &token_1.symbol(),
            &transfer_ids,
            &Vec::new(),
            ts,
        ),
    };
    request_map::update_reply(request_id, Reply::AddPool(reply.clone()));

    Ok(reply)
}

async fn verify_transfer_token(
    request_id: u64,
    token_index: &TokenIndex,
    token: &StableToken,
    tx_id: &Nat,
    amount: &Nat,
    transfer_ids: &mut Vec<u64>,
    ts: u64,
) -> Result<(), String> {
    let token_id = token.token_id();

    match token_index {
        TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::VerifyToken0, None),
        TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::VerifyToken1, None),
    };

    match verify_transfer(token, tx_id, amount).await {
        Ok(_) => {
            // insert_transfer() will use the latest state of TRANSFER_MAP so no reentrancy issues after verify_transfer()
            if transfer_map::contain(token_id, tx_id) {
                let e = format!("Duplicate block id: #{}", tx_id);
                match token_index {
                    TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::VerifyToken0Failed, Some(&e)),
                    TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::VerifyToken1Failed, Some(&e)),
                };
                return Err(e);
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
            transfer_ids.push(transfer_id);
            match token_index {
                TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::VerifyToken0Success, None),
                TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::VerifyToken1Success, None),
            };
            Ok(())
        }
        Err(e) => {
            match token_index {
                TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::VerifyToken0Failed, Some(&e)),
                TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::VerifyToken1Failed, Some(&e)),
            };
            Err(e)
        }
    }
}

#[allow(clippy::too_many_arguments)]
async fn transfer_from_token(
    request_id: u64,
    from_principal_id: &Account,
    token_index: &TokenIndex,
    token: &StableToken,
    amount: &Nat,
    to_principal_id: &Account,
    transfer_ids: &mut Vec<u64>,
    ts: u64,
) -> Result<(), String> {
    let token_id = token.token_id();

    match token_index {
        TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::SendToken0, None),
        TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::SendToken1, None),
    };

    match icrc2_transfer_from(token, amount, from_principal_id, to_principal_id).await {
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
            transfer_ids.push(transfer_id);
            match token_index {
                TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::SendToken0Success, None),
                TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::SendToken1Success, None),
            };
            Ok(())
        }
        Err(e) => {
            match token_index {
                TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::SendToken0Failed, Some(&e)),
                TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::SendToken1Failed, Some(&e)),
            };
            Err(e)
        }
    }
}

fn update_liquidity_pool(
    request_id: u64,
    user_id: u32,
    pool: &StablePool,
    amount_0: &Nat,
    amount_1: &Nat,
    add_lp_token_amount: &Nat,
    ts: u64,
) {
    request_map::update_status(request_id, StatusCode::UpdatePoolAmounts, None);

    let update_pool = StablePool {
        balance_0: nat_add(&pool.balance_0, amount_0),
        balance_1: nat_add(&pool.balance_1, amount_1),
        ..pool.clone()
    };
    pool_map::update(&update_pool);
    request_map::update_status(request_id, StatusCode::UpdatePoolAmountsSuccess, None);

    // update user's LP token amount
    update_lp_token(request_id, user_id, pool.lp_token_id, add_lp_token_amount, ts);
}

fn update_lp_token(request_id: u64, user_id: u32, lp_token_id: u32, add_lp_token_amount: &Nat, ts: u64) {
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
            request_map::update_status(request_id, StatusCode::UpdateUserLPTokenAmountSuccess, None);
        }
        None => {
            // new entry
            let new_user_lp_token = StableLPToken::new(user_id, lp_token_id, add_lp_token_amount.clone(), ts);
            match lp_token_map::insert(&new_user_lp_token) {
                Ok(_) => request_map::update_status(request_id, StatusCode::UpdateUserLPTokenAmountSuccess, None),
                Err(e) => request_map::update_status(request_id, StatusCode::UpdateUserLPTokenAmountFailed, Some(&e)),
            };
        }
    }
}

#[allow(clippy::too_many_arguments)]
async fn return_tokens(
    request_id: u64,
    user_id: u32,
    to_principal_id: &Account,
    transfer_from_token_0: &Result<(), String>,
    token_0: &StableToken,
    amount_0: &Nat,
    transfer_from_token_1: &Result<(), String>,
    token_1: &StableToken,
    amount_1: &Nat,
    transfer_ids: &mut Vec<u64>,
    ts: u64,
) {
    let mut claim_ids = Vec::new();

    if transfer_from_token_0.is_ok() {
        return_token(
            request_id,
            user_id,
            to_principal_id,
            &TokenIndex::Token0,
            token_0,
            amount_0,
            transfer_ids,
            &mut claim_ids,
            ts,
        )
        .await;
    }

    if transfer_from_token_1.is_ok() {
        return_token(
            request_id,
            user_id,
            to_principal_id,
            &TokenIndex::Token1,
            token_1,
            amount_1,
            transfer_ids,
            &mut claim_ids,
            ts,
        )
        .await;
    }

    let reply = to_add_pool_reply_failed(
        request_id,
        &token_0.chain(),
        &token_0.address(),
        &token_0.symbol(),
        &token_1.chain(),
        &token_1.address(),
        &token_1.symbol(),
        transfer_ids,
        &claim_ids,
        ts,
    );
    request_map::update_reply(request_id, Reply::AddPool(reply));
}

#[allow(clippy::too_many_arguments)]
async fn return_token(
    request_id: u64,
    user_id: u32,
    to_principal_id: &Account,
    token_index: &TokenIndex,
    token: &StableToken,
    amount: &Nat,
    transfer_ids: &mut Vec<u64>,
    claim_ids: &mut Vec<u64>,
    ts: u64,
) {
    match token_index {
        TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::ReturnToken0, None),
        TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::ReturnToken1, None),
    };

    // Check if this is a Solana token - if so, create a swap job instead of direct transfer
    if token.chain() == SOL_CHAIN {
        // For Solana tokens, we need to create a swap job that will be processed by kong_rpc
        let to_address = Address::PrincipalId(*to_principal_id);
        match create_solana_swap_job(request_id, user_id, token, amount, &to_address).await {
            Ok(job_id) => {
                let transfer_id = transfer_map::insert(&StableTransfer {
                    transfer_id: 0,
                    request_id,
                    is_send: false,
                    amount: amount.clone(),
                    token_id: token.token_id(),
                    tx_id: TxId::TransactionId(format!("job_{}", job_id)),
                    ts,
                });
                transfer_ids.push(transfer_id);
                match token_index {
                    TokenIndex::Token0 => request_map::update_status(
                        request_id, 
                        StatusCode::ReturnToken0Success, 
                        Some(&format!("Solana swap job #{} created", job_id))
                    ),
                    TokenIndex::Token1 => request_map::update_status(
                        request_id, 
                        StatusCode::ReturnToken1Success, 
                        Some(&format!("Solana swap job #{} created", job_id))
                    ),
                };
            }
            Err(e) => {
                // If job creation fails, save as claim for manual processing
                let claim = StableClaim::new(
                    user_id,
                    token.token_id(),
                    amount,
                    Some(request_id),
                    Some(Address::PrincipalId(*to_principal_id)),
                    ts,
                );
                let claim_id = claim_map::insert(&claim);
                claim_ids.push(claim_id);
                match token_index {
                    TokenIndex::Token0 => request_map::update_status(
                        request_id,
                        StatusCode::ReturnToken0Failed,
                        Some(&format!("Saved as claim #{}. Error creating swap job: {}", claim_id, e)),
                    ),
                    TokenIndex::Token1 => request_map::update_status(
                        request_id,
                        StatusCode::ReturnToken1Failed,
                        Some(&format!("Saved as claim #{}. Error creating swap job: {}", claim_id, e)),
                    ),
                };
            }
        }
    } else {
        // IC token - use existing transfer logic
        let amount_0_with_gas = nat_subtract(amount, &token.fee()).unwrap_or(nat_zero());
        match icrc1_transfer(&amount_0_with_gas, to_principal_id, token, None).await {
            Ok(block_id) => {
                let transfer_id = transfer_map::insert(&StableTransfer {
                    transfer_id: 0,
                    request_id,
                    is_send: false,
                    amount: amount_0_with_gas,
                    token_id: token.token_id(),
                    tx_id: TxId::BlockIndex(block_id),
                    ts,
                });
                transfer_ids.push(transfer_id);
                match token_index {
                    TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::ReturnToken0Success, None),
                    TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::ReturnToken1Success, None),
                };
            }
            Err(e) => {
                let claim = StableClaim::new(
                    user_id,
                    token.token_id(),
                    amount,
                    Some(request_id),
                    Some(Address::PrincipalId(*to_principal_id)),
                    ts,
                );
                let claim_id = claim_map::insert(&claim);
                claim_ids.push(claim_id);
                let message = format!("Saved as claim #{}. {}", claim_id, e);
                match token_index {
                    TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::ReturnToken0Failed, Some(&message)),
                    TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::ReturnToken1Failed, Some(&message)),
                };
            }
        }
    }
}

// add_pool() taken
fn add_new_pool(token_id_0: u32, token_id_1: u32, lp_fee_bps: u8, kong_fee_bps: u8, lp_token_id: u32) -> Result<StablePool, String> {
    let pool = StablePool::new(token_id_0, token_id_1, lp_fee_bps, kong_fee_bps, lp_token_id);
    let pool_id = pool_map::insert(&pool)?;

    // Retrieves the inserted pool by its pool_id
    pool_map::get_by_pool_id(pool_id).ok_or_else(|| "Failed to add pool".to_string())
}

fn archive_to_kong_data(request_id: u64) -> Result<(), String> {
    if !kong_settings_map::get().archive_to_kong_data {
        return Ok(());
    }

    let request = request_map::get_by_request_id(request_id).ok_or(format!("Failed to archive. request_id #{} not found", request_id))?;
    request_map::archive_to_kong_data(&request)?;

    match request.reply {
        Reply::AddPool(ref reply) => {
            // archive claims
            reply
                .claim_ids
                .iter()
                .try_for_each(|&claim_id| claim_map::archive_to_kong_data(claim_id))?;
            // archive transfers
            reply
                .transfer_ids
                .iter()
                .try_for_each(|transfer_id_reply| transfer_map::archive_to_kong_data(transfer_id_reply.transfer_id))?;
            // archive txs
            tx_map::archive_to_kong_data(reply.tx_id)?;
        }
        _ => return Err("Invalid reply type".to_string()),
    }

    Ok(())
}

/// Verify cross-chain transfer using signature verification
#[allow(clippy::too_many_arguments)]
async fn verify_cross_chain_transfer(
    request_id: u64,
    token_index: &TokenIndex,
    token: &StableToken,
    amount: &Nat,
    signature: &str,
    tx_id: &Option<TxId>,
    _timestamp: Option<u64>,
    transfer_ids: &mut Vec<u64>,
    ts: u64,
    args: &AddPoolArgs,
) -> Result<(), String> {
    ic_cdk::println!("DEBUG verify_cross_chain_transfer: Received tx_id: {:?}", tx_id);
    ic_cdk::println!("DEBUG verify_cross_chain_transfer: Token: {:?}, Amount: {:?}", token.symbol(), amount);
    match token_index {
        TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::VerifyToken0, None),
        TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::VerifyToken1, None),
    };
    
    // Ensure we have a transaction ID and extract the actual TxId
    let tx_id_value = tx_id.as_ref()
        .ok_or_else(|| {
            // Debug: check what we received
            match token_index {
                TokenIndex::Token0 => format!("Transaction ID (tx_id_0) is required for cross-chain transfers. Received: {:?}, args.tx_id_0: {:?}", tx_id, args.tx_id_0),
                TokenIndex::Token1 => format!("Transaction ID (tx_id_1) is required for cross-chain transfers. Received: {:?}, args.tx_id_1: {:?}", tx_id, args.tx_id_1),
            }
        })?
        .clone();
    
    // Use the pool-specific payment verifier
    let verifier = PoolPaymentVerifier::new(ICNetwork::caller());
    let verification = verifier.verify_pool_payment(args, token, amount, &tx_id_value, signature)
        .await
        .map_err(|e| {
            let error_msg = format!("Cross-chain pool verification failed: {}", e);
            match token_index {
                TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::VerifyToken0Failed, Some(&error_msg)),
                TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::VerifyToken1Failed, Some(&error_msg)),
            };
            error_msg
        })?;
    
    // Create transfer record based on verification result
    let final_tx_id = match verification {
        PoolPaymentVerification::SolanaPayment { tx_signature, .. } => TxId::TransactionId(tx_signature),
    };
    
    let transfer_id = transfer_map::insert(&StableTransfer {
        transfer_id: 0,
        request_id,
        is_send: true,
        amount: amount.clone(),
        token_id: token.token_id(),
        tx_id: final_tx_id,
        ts,
    });
    transfer_ids.push(transfer_id);
    
    match token_index {
        TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::VerifyToken0Success, None),
        TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::VerifyToken1Success, None),
    };
    
    Ok(())
}
