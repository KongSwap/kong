use candid::Nat;
use ic_cdk::update;
use icrc_ledger_types::icrc1::account::Account;

use super::add_pool_args::AddPoolArgs;
use super::add_pool_reply::AddPoolReply;
use super::add_pool_reply_helpers::{create_add_pool_reply_failed, create_add_pool_reply_with_tx_id};

use crate::add_token::add_token::{add_ic_token, add_lp_token};
use crate::chains::chains::{IC_CHAIN, LP_CHAIN};
use crate::helpers::nat_helpers::{nat_add, nat_is_zero, nat_multiply, nat_sqrt, nat_subtract, nat_to_decimal_precision, nat_zero};
use crate::ic::{
    address::Address,
    ckusdt::is_ckusdt,
    get_time::get_time,
    guards::not_in_maintenance_mode,
    icp::is_icp,
    id::{caller_id, is_caller_controller},
    transfer::{icrc1_transfer, icrc2_transfer_from},
    verify::verify_transfer,
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

enum TokenIndex {
    Token0,
    Token1,
}

/// Adds a pool to the system
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
    let (user_id, token_0, add_amount_0, tx_id_0, token_1, add_amount_1, tx_id_1, lp_fee_bps, kong_fee_bps, add_lp_token_amount, on_kong) =
        check_arguments(&args).await?;
    let ts = get_time();
    let request = StableRequest::new(user_id, &Request::AddPool(args), ts);
    let request_id = request_map::insert(&request);

    let result = process_add_pool(
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
        on_kong,
        ts,
    )
    .await
    .map_or_else(
        |e| {
            request_map::update_status(request_id, StatusCode::Failed, Some(&e));
            Err(e)
        },
        |reply| {
            request_map::update_status(request_id, StatusCode::Success, None);
            Ok(reply)
        },
    );

    archive_to_kong_data(request);

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
/// * `Ok((user_id, token_0, amount_0, tx_id_0, token_1, add_amount_1, tx_id_1, lp_fee_bps, on_kong))`
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
/// *   `on_kong` - Whether the pool is on Kong.
/// * `Err(String)` - An error message if the operation fails.
async fn check_arguments(
    args: &AddPoolArgs,
) -> Result<(u32, StableToken, Nat, Option<Nat>, StableToken, Nat, Option<Nat>, u8, u8, Nat, bool), String> {
    if nat_is_zero(&args.amount_0) || nat_is_zero(&args.amount_1) {
        return Err("Invalid zero amounts".to_string());
    }

    // can overwrite lp_fee_bps
    let default_lp_fee_bps = kong_settings_map::get().default_lp_fee_bps;
    let lp_fee_bps = args.lp_fee_bps.unwrap_or(default_lp_fee_bps);

    let default_kong_fee_bps = kong_settings_map::get().default_kong_fee_bps;
    // only controllers can set kong_fee_bps otherwise use default
    let kong_fee_bps = match is_caller_controller() {
        true => args.kong_fee_bps.unwrap_or(default_kong_fee_bps),
        false => default_kong_fee_bps,
    };

    if kong_fee_bps > lp_fee_bps {
        return Err("Kong fee cannot be greater than LP fee".to_string());
    }

    // only controllers can add a token and pool to Kong
    let on_kong = is_caller_controller() && args.on_kong.unwrap_or(false);

    // check tx_id_0 and tx_id_1 are valid block index Nat
    let tx_id_0 = match &args.tx_id_0 {
        Some(tx_id_0) => match tx_id_0 {
            TxId::BlockIndex(block_id) => Some(block_id).cloned(),
            _ => return Err("Unsupported tx_id_0".to_string()),
        },
        None => None,
    };
    let tx_id_1 = match &args.tx_id_1 {
        Some(tx_id_1) => match tx_id_1 {
            TxId::BlockIndex(block_id) => Some(block_id).cloned(),
            _ => return Err("Unsupported tx_id_1".to_string()),
        },
        None => None,
    };

    // make sure token_1 is ckUSDT or ICP
    let token_1 = match args.token_1.as_str() {
        token if is_ckusdt(token) => token_map::get_ckusdt()?,
        token if is_icp(token) => token_map::get_icp()?,
        _ => {
            return Err(format!(
                "Token_1 must be {} or {}",
                kong_settings_map::get().ckusdt_symbol,
                kong_settings_map::get().icp_symbol
            ))
        }
    };

    // token_0, check if it exists already or needs to be added
    // leave token_0 check latest as possible as token will be added to the system
    let token_0 = match token_map::get_by_token(&args.token_0) {
        Ok(token) => token, // token_0 exists already
        Err(_) => {
            // token_0 needs to add it. Only IC tokens of format IC.CanisterId supported
            match token_map::get_chain(&args.token_0) {
                Some(chain) if chain == IC_CHAIN => add_ic_token(&args.token_0, on_kong).await?,
                Some(chain) if chain == LP_CHAIN => return Err("Token_0 LP tokens not supported".to_string()),
                Some(_) | None => return Err("Token_0 chain not specified or supported".to_string()),
            }
        }
    };

    // make sure LP token does not already exist
    let lp_token_address = token::address(&token_0, &token_1);
    if token_map::exists(&lp_token_address) {
        return Err(format!("LP token {} already exists", token::symbol(&token_0, &token_1)));
    }

    // make sure pool does not already exist
    if pool_map::exists(&token_0, &token_1) {
        return Err(format!("Pool {} already exists", pool_map::symbol(&token_0, &token_1)));
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
        on_kong,
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
    on_kong: bool,
    ts: u64,
) -> Result<AddPoolReply, String> {
    let caller_id = caller_id();
    let kong_backend = kong_settings_map::get().kong_backend_account;
    let mut transfer_ids = Vec::new();

    request_map::update_status(request_id, StatusCode::Start, None);

    let transfer_0 = match tx_id_0 {
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
    };

    let transfer_1 = match tx_id_1 {
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
            on_kong,
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
    let lp_token = match add_lp_token(token_0, token_1, on_kong) {
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
                on_kong,
                ts,
            )
            .await;
            return Err(format!("Req #{} failed. {}", request_id, e));
        }
    };

    // add pool
    request_map::update_status(request_id, StatusCode::AddPool, None);
    let pool = StablePool::new(
        token_0.token_id(),
        token_1.token_id(),
        lp_fee_bps,
        kong_fee_bps,
        lp_token.token_id(),
        on_kong,
    );
    let pool_id = match pool_map::insert(&pool) {
        Ok(pool_id) => {
            request_map::update_status(request_id, StatusCode::AddPoolSuccess, None);
            pool_id
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
                on_kong,
                ts,
            )
            .await;
            return Err(format!("Req #{} failed. {}", request_id, e));
        }
    };

    // update pool with new balances
    update_liquidity_pool(request_id, user_id, &pool, amount_0, amount_1, add_lp_token_amount, ts);

    // successful, add tx and update request with reply
    let add_pool_tx = AddPoolTx::new_success(
        pool_id,
        user_id,
        request_id,
        amount_0,
        amount_1,
        add_lp_token_amount,
        &transfer_ids,
        &Vec::new(),
        on_kong,
        ts,
    );
    let tx_id = tx_map::insert(&StableTx::AddPool(add_pool_tx.clone()));
    let reply = create_add_pool_reply_with_tx_id(tx_id, &add_pool_tx);
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
    on_kong: bool,
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

    // Token0
    let chain_0 = token_0.chain();
    let symbol_0 = token_0.symbol();
    // Token1
    let chain_1 = token_1.chain();
    let symbol_1 = token_1.symbol();
    let reply = create_add_pool_reply_failed(
        &chain_0,
        &symbol_0,
        &chain_1,
        &symbol_1,
        request_id,
        transfer_ids,
        &claim_ids,
        on_kong,
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
            // attempt to return token_0 failed, so save as a claim
            let message = match claim_map::insert(&StableClaim::new(
                user_id,
                token.token_id(),
                amount,
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
            match token_index {
                TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::ReturnToken0Failed, Some(&message)),
                TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::ReturnToken1Failed, Some(&message)),
            };
        }
    }
}

pub fn archive_to_kong_data(request: StableRequest) {
    request_map::archive_request_to_kong_data(request.request_id);
    if let Reply::AddPool(reply) = request.reply {
        for claim_id in reply.claim_ids.iter() {
            claim_map::archive_claim_to_kong_data(*claim_id);
        }
        for transfer_id_reply in reply.transfer_ids.iter() {
            transfer_map::archive_transfer_to_kong_data(transfer_id_reply.transfer_id);
        }
        tx_map::archive_tx_to_kong_data(reply.tx_id);
    };
}
