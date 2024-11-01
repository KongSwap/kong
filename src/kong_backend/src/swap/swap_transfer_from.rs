use candid::Nat;

use super::calculate_amounts::calculate_amounts;
use super::return_pay_token::return_pay_token;
use super::send_receive_token::send_receive_token;
use super::swap_args::SwapArgs;
use super::swap_reply::SwapReply;
use super::update_liquidity_pool::update_liquidity_pool;

use crate::helpers::nat_helpers::nat_is_zero;
use crate::ic::{address::Address, address_impl::get_address, get_time::get_time, id::caller_id, transfer::icrc2_transfer_from};
use crate::stable_kong_settings::kong_settings;
use crate::stable_request::{request::Request, request_map, stable_request::StableRequest, status::StatusCode};
use crate::stable_token::{stable_token::StableToken, token::Token, token_map};
use crate::stable_transfer::{stable_transfer::StableTransfer, transfer_map, tx_id::TxId};
use crate::stable_user::user_map;

pub async fn swap_transfer_from(args: SwapArgs) -> Result<SwapReply, String> {
    let (user_id, pay_token, pay_amount, receive_token, max_slippage, to_address) = check_arguments(&args)?;

    let receive_amount = args.receive_amount.clone();
    let ts = get_time();
    let request_id = request_map::insert(&StableRequest::new(user_id, &Request::Swap(args), ts));

    let error = match process_swap(
        request_id,
        user_id,
        &pay_token,
        &pay_amount,
        &receive_token,
        receive_amount.as_ref(),
        max_slippage,
        &to_address,
        ts,
    )
    .await
    {
        Ok(reply) => {
            request_map::update_status(request_id, StatusCode::Success, None);
            return Ok(reply);
        }
        Err(e) => e,
    };

    request_map::update_status(request_id, StatusCode::Failed, None);
    Err(error)
}

pub async fn swap_transfer_from_async(args: SwapArgs) -> Result<u64, String> {
    let (user_id, pay_token, pay_amount, receive_token, max_slippage, to_address) = check_arguments(&args)?;

    let receive_amount = args.receive_amount.clone();
    let ts = get_time();
    let request_id = request_map::insert(&StableRequest::new(user_id, &Request::Swap(args), ts));

    ic_cdk::spawn(async move {
        if (process_swap(
            request_id,
            user_id,
            &pay_token,
            &pay_amount,
            &receive_token,
            receive_amount.as_ref(),
            max_slippage,
            &to_address,
            ts,
        )
        .await)
            .is_ok()
        {
            request_map::update_status(request_id, StatusCode::Success, None);
            return;
        }

        request_map::update_status(request_id, StatusCode::Failed, None);
    });

    Ok(request_id)
}

#[allow(clippy::type_complexity)]
fn check_arguments(args: &SwapArgs) -> Result<(u32, StableToken, Nat, StableToken, f64, Address), String> {
    let pay_token = token_map::get_by_token(&args.pay_token)?;
    let pay_amount = args.pay_amount.clone();
    let receive_token = token_map::get_by_token(&args.receive_token)?;
    // use specified max slippage or use default
    let max_slippage = args.max_slippage.unwrap_or(kong_settings::get().default_max_slippage);
    // use specified address or default to caller's principal id
    let to_address = match args.receive_address {
        Some(ref address) => get_address(address).ok_or("Invalid receive address")?,
        None => Address::PrincipalId(caller_id()),
    };
    if nat_is_zero(&pay_amount) {
        return Err("Pay amount is zero".to_string());
    }

    // check to make sure pay_tx_id is not specified
    if args.pay_tx_id.is_some() {
        return Err("Pay tx_id not supported".to_string());
    }

    // make sure user is registered, if not create a new user with referred_by if specified
    let user_id = user_map::insert(args.referred_by.as_deref())?;

    // calculate receive_amount and swaps
    // no needs to store the return values as it'll be called again in process_swap
    calculate_amounts(&pay_token, &pay_amount, &receive_token, args.receive_amount.as_ref(), max_slippage)?;

    Ok((user_id, pay_token, pay_amount, receive_token, max_slippage, to_address))
}

// swaps needs to be passed in to get the pool of the pay token which is needed to determine if the
// pay_tx_id is a double spend
#[allow(clippy::too_many_arguments)]
async fn process_swap(
    request_id: u64,
    user_id: u32,
    pay_token: &StableToken,
    pay_amount: &Nat,
    receive_token: &StableToken,
    receive_amount: Option<&Nat>,
    max_slippage: f64,
    to_address: &Address,
    ts: u64,
) -> Result<SwapReply, String> {
    // update the request status
    request_map::update_status(request_id, StatusCode::Start, None);

    // process transfer_from of pay token
    let pay_transfer_id = transfer_from_token(request_id, pay_token, pay_amount, ts).await?;

    // from this point, pay token has been transferred to the canister. Any errors from now on we will need to return pay token back to the user
    // empty vector to store the block ids of the on-chain transfers
    let mut transfer_ids = Vec::new();
    transfer_ids.push(pay_transfer_id);

    // re-calculate receive_amount and swaps with the latest pool state
    match update_liquidity_pool(request_id, pay_token, pay_amount, receive_token, receive_amount, max_slippage) {
        Ok((receive_amount, mid_price, price, slippage, swaps)) => {
            // send_receive_token() will always return a SwapReply
            Ok(send_receive_token(
                request_id,
                user_id,
                pay_token,
                pay_amount,
                receive_token,
                &receive_amount,
                to_address,
                &mut transfer_ids,
                mid_price,
                price,
                slippage,
                &swaps,
                ts,
            )
            .await)
        }
        Err(e) => {
            // return pay token back to user
            return_pay_token(
                request_id,
                user_id,
                pay_token,
                pay_amount,
                Some(receive_token),
                &mut transfer_ids,
                ts,
            )
            .await;
            let error = format!("Swap #{} failed: {}", request_id, e);
            Err(error)
        }
    }
}

async fn transfer_from_token(request_id: u64, token: &StableToken, amount: &Nat, ts: u64) -> Result<u64, String> {
    let symbol = token.symbol();
    let token_id = token.token_id();

    let caller_id = caller_id();

    request_map::update_status(request_id, StatusCode::SendPayToken, None);

    match icrc2_transfer_from(token, amount, &caller_id, &kong_settings::get().kong_backend_account).await {
        Ok(tx_id) => {
            // insert_transfer() will use the latest state of TRANSFER_MAP to prevent reentrancy issues after icrc2_transfer_from()
            // as icrc2_transfer_from() does a new transfer so tx_id will be new
            let transfer_id = transfer_map::insert(&StableTransfer {
                transfer_id: 0,
                request_id,
                is_send: true,
                amount: amount.clone(),
                token_id,
                tx_id: TxId::BlockIndex(tx_id),
                ts,
            });
            request_map::update_status(request_id, StatusCode::SendPayTokenSuccess, None);
            Ok(transfer_id)
        }
        Err(e) => {
            let error = format!("Swap #{} failed transfer_from user {} {}: {}", request_id, amount, symbol, e,);
            request_map::update_status(request_id, StatusCode::SendPayTokenFailed, Some(e));
            Err(error)
        }
    }
}
