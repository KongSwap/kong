use candid::Nat;
use ic_cdk::update;

use super::send_args::SendArgs;
use super::send_reply::SendReply;
use super::send_reply_helpers::{create_send_reply_failed, create_send_reply_with_tx_id};

use crate::chains::chains::LP_CHAIN;
use crate::ic::{get_time::get_time, guards::not_in_maintenance_mode};
use crate::stable_lp_token::transfer::transfer;
use crate::stable_request::request_map;
use crate::stable_request::{reply::Reply, request::Request, stable_request::StableRequest, status::StatusCode};
use crate::stable_token::stable_token::StableToken::LP;
use crate::stable_token::token_map;
use crate::stable_tx::send_tx::SendTx;
use crate::stable_tx::stable_tx::StableTx;
use crate::stable_tx::tx_map;
use crate::stable_user::user_map;

/// Send LP token to another user
#[update(guard = "not_in_maintenance_mode")]
async fn send(args: SendArgs) -> Result<SendReply, String> {
    // support only for LP tokens
    let lp_token = match token_map::get_by_token(&args.token) {
        Ok(LP(token)) => token,
        Err(e) => return Err(e),
        _ => return Err("Token not supported".to_string()),
    };
    let lp_token_id = lp_token.token_id;
    let lp_token_chain = LP_CHAIN;
    let lp_token_symbol = lp_token.symbol;

    // to user
    let to_user = user_map::get_by_principal_id(&args.to_address)
        .ok()
        .flatten()
        .ok_or("User not found")?;
    let to_user_id = to_user.user_id;
    let to_address = &args.to_address;
    let amount = &args.amount;

    // make sure user is registered, if not create a new user
    let user_id = user_map::insert(None)?;

    let ts: u64 = get_time();
    let request_id = request_map::insert(&StableRequest::new(user_id, &Request::Send(args.clone()), ts));

    process_send(
        request_id,
        user_id,
        to_user_id,
        to_address,
        lp_token_id,
        lp_token_chain,
        &lp_token_symbol,
        amount,
        ts,
    )
    .map_or_else(
        |e| {
            request_map::update_status(request_id, StatusCode::Failed, Some(&e));
            Err(e)
        },
        |reply| {
            request_map::update_status(request_id, StatusCode::Success, None);
            archive_to_kong_data(&reply);
            Ok(reply)
        },
    )
}

#[allow(clippy::too_many_arguments)]
fn process_send(
    request_id: u64,
    from_user_id: u32,
    to_user_id: u32,
    to_address: &str,
    lp_token_id: u32,
    lp_token_chain: &str,
    lp_token_symbol: &str,
    amount: &Nat,
    ts: u64,
) -> Result<SendReply, String> {
    request_map::update_status(request_id, StatusCode::Start, None);

    request_map::update_status(request_id, StatusCode::SendLPTokenToUser, None);
    match transfer(lp_token_id, to_user_id, amount) {
        Ok(_) => {
            request_map::update_status(request_id, StatusCode::SendLPTokenToUserSuccess, None);
        }
        Err(e) => {
            request_map::update_status(request_id, StatusCode::SendLPTokenToUserFailed, Some(&e));

            let reply = create_send_reply_failed(request_id, lp_token_chain, lp_token_symbol, amount, to_address, ts);
            request_map::update_reply(request_id, Reply::Send(reply.clone()));
            return Err(format!("Req #{} failed. {}", request_id, e));
        }
    }

    // successful, add send_tx and update request with reply
    let send_tx = SendTx::new_success(from_user_id, request_id, to_user_id, lp_token_id, amount, ts);
    let tx_id = tx_map::insert(&StableTx::Send(send_tx.clone()));

    let reply = create_send_reply_with_tx_id(tx_id, &send_tx);
    request_map::update_reply(request_id, Reply::Send(reply.clone()));

    Ok(reply)
}

fn archive_to_kong_data(reply: &SendReply) {
    request_map::archive_request_to_kong_data(reply.request_id);
    tx_map::archive_tx_to_kong_data(reply.tx_id);
}
