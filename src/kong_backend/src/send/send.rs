use ic_cdk::update;

use super::send_args::SendArgs;
use super::send_reply::SendReply;

use crate::chains::chains::LP_CHAIN;
use crate::ic::{get_time::get_time, guards::not_in_maintenance_mode};
use crate::stable_lp_token_ledger::lp_token_ledger;
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
fn send(args: SendArgs) -> Result<SendReply, String> {
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

    request_map::update_status(request_id, StatusCode::Start, None);

    request_map::update_status(request_id, StatusCode::SendLPTokenToUser, None);
    let reply = match lp_token_ledger::transfer(lp_token_id, to_user_id, amount) {
        Ok(_) => {
            request_map::update_status(request_id, StatusCode::SendLPTokenToUserSuccess, None);

            request_map::update_status(request_id, StatusCode::Success, None);

            // insert a send_tx
            let send_tx = SendTx::new_success(user_id, request_id, to_user_id, lp_token_id, amount, ts);
            let tx_id = tx_map::insert(&StableTx::Send(send_tx.clone()));
            // update request with successful reply
            SendReply::new_with_tx_id(tx_id, &send_tx)
        }
        Err(e) => {
            request_map::update_status(request_id, StatusCode::SendLPTokenToUserFailed, Some(e));

            request_map::update_status(request_id, StatusCode::Failed, None);

            // update request with failed reply
            SendReply::new_failed(request_id, lp_token_chain, &lp_token_symbol, amount, to_address, ts)
        }
    };

    request_map::update_reply(request_id, Reply::Send(reply.clone()));

    Ok(reply)
}
