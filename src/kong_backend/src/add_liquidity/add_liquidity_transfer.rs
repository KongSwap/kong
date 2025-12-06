use candid::Nat;
use transfer_lib::get_address::get_caller_address;

use super::add_liquidity::TokenIndex;
use super::add_liquidity_reply_helpers::{to_add_liquidity_reply, to_add_liquidity_reply_failed};
use kong_lib::add_liquidity::add_liquidity_args::AddLiquidityArgs;
use kong_lib::add_liquidity::add_liquidity_reply::AddLiquidityReply;

use crate::add_liquidity::add_liquidity_transfer_from::{archive_to_kong_data, update_liquidity_pool};
use crate::add_token::add_token::add_lp_token;
use crate::ic::get_time::get_time;
use crate::stable_kong_settings::kong_settings_map;
use crate::stable_pool::pool_map;
use crate::stable_pool::stable_pool::StablePool;
use crate::stable_request::request_map;
use crate::stable_token::token_map;
use crate::stable_tx::{add_liquidity_tx::AddLiquidityTx, stable_tx::StableTx, tx_map};
use crate::stable_user::user_map;
use crate::transfers::receive_args_helpers::create_add_liquidity_receive_args;
use crate::transfers::send_token_or_claim;
use kong_lib::ic::address::Address;
use kong_lib::stable_request::{reply::Reply, request::Request, stable_request::StableRequest, status::StatusCode};
use kong_lib::stable_token::{stable_token::StableToken, token::Token};

pub async fn add_liquidity_transfer(args: AddLiquidityArgs) -> Result<AddLiquidityReply, String> {
    // user has transferred one of the tokens, we need to log the request immediately and verify the transfer
    // make sure user is registered, if not create a new user with referred_by if specified
    let user_id = user_map::insert(None)?;
    let ts = get_time();
    let request_id = request_map::insert(&StableRequest::new(user_id, &Request::AddLiquidity(args.clone()), ts));

    let (transfer_id_0, transfer_1, token_0, token_1, stable_pool) =
        check_and_receive(&args, user_id, request_id, ts).await.inspect_err(|_| {
            request_map::update_status(request_id, StatusCode::Failed, None);
            _ = archive_to_kong_data(request_id);
        })?;

    let result = match process_add_liquidity(
        request_id,
        user_id,
        transfer_id_0,
        transfer_1,
        token_0,
        token_1,
        stable_pool,
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
            request_map::update_status(request_id, StatusCode::Failed, None);
            Err(e)
        }
    };
    _ = archive_to_kong_data(request_id);

    result
}

pub async fn add_liquidity_transfer_async(args: AddLiquidityArgs) -> Result<u64, String> {
    let user_id = user_map::insert(None)?;
    let ts = get_time();
    let request_id = request_map::insert(&StableRequest::new(user_id, &Request::AddLiquidity(args.clone()), ts));

    let (transfer_0, transfer_1, token_0, token_1, stable_pool) =
        check_and_receive(&args, user_id, request_id, ts).await.inspect_err(|_| {
            request_map::update_status(request_id, StatusCode::Failed, None);
            _ = archive_to_kong_data(request_id);
        })?;

    ic_cdk::futures::spawn(async move {
        match process_add_liquidity(
            request_id,
            user_id,
            transfer_0,
            transfer_1,
            token_0,
            token_1,
            stable_pool,
            &args,
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

fn add_new_pool_impl(token_id_0: u32, token_id_1: u32, lp_fee_bps: u8, kong_fee_bps: u8, lp_token_id: u32) -> Result<StablePool, String> {
    let pool = StablePool::new(token_id_0, token_id_1, lp_fee_bps, kong_fee_bps, lp_token_id);
    let pool_id = pool_map::insert(&pool)?;

    // Retrieves the inserted pool by its pool_id
    pool_map::get_by_pool_id(pool_id).ok_or_else(|| "Failed to add pool".to_string())
}

async fn add_new_pool(token_0: &StableToken, token_1: &StableToken, request_id: u64) -> Result<StablePool, String> {
    let lp_token = match add_lp_token(token_0, token_1) {
        Ok(lp_token) => {
            request_map::update_status(request_id, StatusCode::AddLPTokenSuccess, None);
            lp_token
        }
        Err(e) => {
            request_map::update_status(request_id, StatusCode::AddLPTokenFailed, Some(&e));
            Err(format!("Req #{} failed. {}", request_id, e))?
        }
    };

    let kong_settings = kong_settings_map::get();
    let kong_fee_bps = kong_settings.default_kong_fee_bps;
    let lp_fee_bps = kong_settings.default_lp_fee_bps;

    request_map::update_status(request_id, StatusCode::AddPool, None);
    let pool = match add_new_pool_impl(
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
            Err(format!("Req #{} failed. {}", request_id, e))?
        }
    };

    Ok(pool)
}

async fn receive_token(args: &AddLiquidityArgs, is_token_0: bool, request_id: u64, ts: u64) -> Result<(StableToken, u64), String> {
    let (token_symbol, status_not_found, status_verify, status_verify_success, status_verify_failed) = if is_token_0 {
        (
            &args.token_0,
            StatusCode::Token0NotFound,
            StatusCode::VerifyToken0,
            StatusCode::VerifyToken0Success,
            StatusCode::VerifyToken0Failed,
        )
    } else {
        (
            &args.token_1,
            StatusCode::Token1NotFound,
            StatusCode::VerifyToken1,
            StatusCode::VerifyToken1Success,
            StatusCode::VerifyToken1Failed,
        )
    };
    let token = match token_map::get_by_token(token_symbol) {
        Ok(token) => token,
        Err(e) => {
            request_map::update_status(request_id, status_not_found, Some(&e));
            return Err(e);
        }
    };

    request_map::update_status(request_id, status_verify, None);
    let transfer_id =
        match transfer_lib::receive::receive_not_used(&token, create_add_liquidity_receive_args(&token, args, is_token_0)?, request_id, ts)
            .await
        {
            Ok(v) => {
                request_map::update_status(request_id, status_verify_success, None);
                v
            }
            Err(e) => {
                request_map::update_status(request_id, status_verify_failed, Some(&e));
                Err(e)?
            }
        };

    Ok((token, transfer_id))
}

async fn check_and_receive_cleanup(
    args: &AddLiquidityArgs,
    user_id: u32,
    request_id: u64,
    ts: u64,
    receive_0: Result<(StableToken, u64), String>,
    receive_1: Result<(StableToken, u64), String>,
) {
    let mut dummy_transfer_ids = Vec::<u64>::new();
    let mut dummy_claim_ids = Vec::<u64>::new();

    if let Ok((token_0, _)) = receive_0 {
        let address_0 = get_caller_address(&token_0, args.tx_id_0.as_ref());
        return_token(
            request_id,
            user_id,
            address_0,
            &TokenIndex::Token0,
            &token_0,
            &args.amount_0,
            &mut dummy_transfer_ids,
            &mut dummy_claim_ids,
            ts,
        )
        .await;
    };
    if let Ok((token_1, _)) = receive_1 {
        let address_1 = get_caller_address(&token_1, args.tx_id_1.as_ref());
        return_token(
            request_id,
            user_id,
            address_1,
            &TokenIndex::Token1,
            &token_1,
            &args.amount_1,
            &mut dummy_transfer_ids,
            &mut dummy_claim_ids,
            ts,
        )
        .await;
    };
}

async fn check_and_receive(
    args: &AddLiquidityArgs,
    user_id: u32,
    request_id: u64,
    ts: u64,
) -> Result<(u64, u64, StableToken, StableToken, StablePool), String> {
    // update the request status
    request_map::update_status(request_id, StatusCode::Start, None);

    let receive_0 = receive_token(args, true, request_id, ts).await;
    let receive_1 = receive_token(args, false, request_id, ts).await;

    if receive_0.is_err() || receive_1.is_err() {
        let err = receive_0.clone().err().or(receive_1.clone().err()).unwrap();
        check_and_receive_cleanup(args, user_id, request_id, ts, receive_0, receive_1).await;
        return Err(err);
    }

    let (token_0, tx0) = receive_0.unwrap();
    let (token_1, tx1) = receive_1.unwrap();

    let stable_pool = match pool_map::get_by_token_ids(token_0.token_id(), token_1.token_id()) {
        Some(stable_pool) => stable_pool,
        None => match add_new_pool(&token_0, &token_1, request_id).await {
            Ok(stable_pool) => stable_pool,
            Err(e) => {
                check_and_receive_cleanup(args, user_id, request_id, ts, Ok((token_0, tx0)), Ok((token_1, tx1))).await;
                return Err(e);
            }
        },
    };

    Ok((tx0, tx1, token_0, token_1, stable_pool))
}

#[allow(clippy::too_many_arguments)]
async fn process_add_liquidity(
    request_id: u64,
    user_id: u32,
    transfer_0: u64,
    transfer_1: u64,
    token_0: StableToken,
    token_1: StableToken,
    pool: StablePool,
    args: &AddLiquidityArgs,
    ts: u64,
) -> Result<AddLiquidityReply, String> {
    let add_amount_0 = &args.amount_0;
    let add_amount_1 = &args.amount_1;

    let mut transfer_ids = Vec::new();
    transfer_ids.push(transfer_0);
    transfer_ids.push(transfer_1);

    let mut claim_ids = Vec::new();

    // re-calculate with latest pool state and make sure amounts are valid
    let (pool, amount_0, amount_1, add_lp_token_amount) =
        match update_liquidity_pool(request_id, user_id, &pool, add_amount_0, add_amount_1, ts) {
            Ok((pool, amount_0, amount_1, add_lp_token_amount)) => (pool, amount_0, amount_1, add_lp_token_amount),
            Err(e) => {
                // LP amounts are incorrect. return token_0 and token_1 back to user
                return_token(
                    request_id,
                    user_id,
                    get_caller_address(&token_0, args.tx_id_0.as_ref()),
                    &TokenIndex::Token0,
                    &token_0,
                    &args.amount_0,
                    &mut transfer_ids,
                    &mut claim_ids,
                    ts,
                )
                .await;
                return_token(
                    request_id,
                    user_id,
                    get_caller_address(&token_1, args.tx_id_1.as_ref()),
                    &TokenIndex::Token1,
                    &token_1,
                    &args.amount_1,
                    &mut transfer_ids,
                    &mut claim_ids,
                    ts,
                )
                .await;

                Err(format!("Req #{} failed. {}", request_id, e))?
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
    let reply = match tx_map::get_by_user_and_token_id(Some(tx_id), None, None, None).first() {
        Some(StableTx::AddLiquidity(add_liquidity_tx)) => to_add_liquidity_reply(add_liquidity_tx),
        _ => to_add_liquidity_reply_failed(pool.pool_id, request_id, &transfer_ids, &Vec::new(), ts),
    };
    request_map::update_reply(request_id, Reply::AddLiquidity(reply.clone()));

    Ok(reply)
}

#[allow(clippy::too_many_arguments)]
async fn return_token(
    request_id: u64,
    user_id: u32,
    address: Result<Address, String>,
    token_index: &TokenIndex,
    token: &StableToken,
    amount: &Nat,
    transfer_ids: &mut Vec<u64>,
    claim_ids: &mut Vec<u64>,
    ts: u64,
) {
    let address = match address {
        Ok(address) => address,
        Err(e) => {
            match token_index {
                TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::ReturnToken0Failed, Some(&e)),
                TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::ReturnToken1Failed, Some(&e)),
            };
            return;
        }
    };

    match token_index {
        TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::ReturnToken0, None),
        TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::ReturnToken1, None),
    };

    match send_token_or_claim::send_token_or_claim(request_id, user_id, &address, token, &amount, ts).await {
        send_token_or_claim::ReturnTokenResult::TransferId(tx_id) => transfer_ids.push(tx_id),
        send_token_or_claim::ReturnTokenResult::ClaimId(claim_id, e) => {
            claim_ids.push(claim_id);
            let message = format!("Saved as claim #{}. {}", claim_id, e);
            match token_index {
                TokenIndex::Token0 => request_map::update_status(request_id, StatusCode::ReturnToken0Failed, Some(&message)),
                TokenIndex::Token1 => request_map::update_status(request_id, StatusCode::ReturnToken1Failed, Some(&message)),
            };
        }
    }
}
