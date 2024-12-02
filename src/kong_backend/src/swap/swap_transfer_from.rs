use candid::Nat;
use ic_cdk::api::call;
use icrc_ledger_types::icrc1::account::Account;

use super::calculate_amounts::calculate_amounts;
use super::return_pay_token::return_pay_token;
use super::send_receive_token::send_receive_token;
use super::swap_args::SwapArgs;
use super::swap_reply::SwapReply;
use super::update_liquidity_pool::update_liquidity_pool;

use crate::helpers::nat_helpers::nat_is_zero;
use crate::ic::address::Address;
use crate::ic::address_helpers::get_address;
use crate::ic::get_time::get_time;
use crate::ic::id::caller_id;
use crate::ic::transfer::icrc2_transfer_from;
use crate::stable_claim::claim_map;
use crate::stable_kong_settings::kong_settings_map;
use crate::stable_request::{reply::Reply, request::Request, request_map, stable_request::StableRequest, status::StatusCode};
use crate::stable_token::{stable_token::StableToken, token::Token, token_map};
use crate::stable_transfer::{stable_transfer::StableTransfer, transfer_map, tx_id::TxId};
use crate::stable_tx::tx_map;
use crate::stable_user::user_map;

pub async fn swap_transfer_from(args: SwapArgs) -> Result<SwapReply, String> {
    let (user_id, pay_token, pay_amount, receive_token, max_slippage, to_address) = check_arguments(&args).await?;
    let ts = get_time();
    let receive_amount = args.receive_amount.clone();
    let request = StableRequest::new(user_id, &Request::Swap(args), ts);
    let request_id = request_map::insert(&request);

    let result = process_swap(
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

pub async fn swap_transfer_from_async(args: SwapArgs) -> Result<u64, String> {
    let (user_id, pay_token, pay_amount, receive_token, max_slippage, to_address) = check_arguments(&args).await?;
    let ts = get_time();
    let receive_amount = args.receive_amount.clone();
    let request = StableRequest::new(user_id, &Request::Swap(args), ts);
    let request_id = request_map::insert(&request);

    ic_cdk::spawn(async move {
        match process_swap(
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
            Ok(_) => request_map::update_status(request_id, StatusCode::Success, None),
            Err(e) => request_map::update_status(request_id, StatusCode::Failed, Some(&e)),
        };

        archive_to_kong_data(request);
    });

    Ok(request_id)
}

async fn check_arguments(args: &SwapArgs) -> Result<(u32, StableToken, Nat, StableToken, f64, Address), String> {
    let pay_token = token_map::get_by_token(&args.pay_token)?;
    let pay_amount = args.pay_amount.clone();
    let receive_token = token_map::get_by_token(&args.receive_token)?;
    // use specified max slippage or use default
    let max_slippage = args.max_slippage.unwrap_or(kong_settings_map::get().default_max_slippage);
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

    if !pay_token.is_icrc2() {
        return Err("Pay token must support ICRC2".to_string());
    }

    // make sure user is registered, if not create a new user with referred_by if specified
    let user_id = user_map::insert(args.referred_by.as_deref())?;

    // calculate receive_amount and swaps. do after user_id is created as it will be needed to calculate the receive_amount (user fee level)
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
    let caller_id = caller_id();
    let kong_backend = kong_settings_map::get().kong_backend_account;
    let mut transfer_ids = Vec::new();

    request_map::update_status(request_id, StatusCode::Start, None);

    transfer_from_token(request_id, &caller_id, pay_token, pay_amount, &kong_backend, &mut transfer_ids, ts)
        .await
        .map_err(|e| format!("Pay token transfer_from failed. {}", e))?;

    // re-calculate receive_amount and swaps with the latest pool state
    let (receive_amount, mid_price, price, slippage, swaps) =
        match update_liquidity_pool(request_id, pay_token, pay_amount, receive_token, receive_amount, max_slippage) {
            Ok((receive_amount, mid_price, price, slippage, swaps)) => (receive_amount, mid_price, price, slippage, swaps),
            Err(e) => {
                // return pay token back to user
                return_pay_token(
                    request_id,
                    user_id,
                    &caller_id,
                    pay_token,
                    pay_amount,
                    Some(receive_token),
                    &mut transfer_ids,
                    ts,
                )
                .await;
                return Err(format!("Req #{} failed. {}", request_id, e));
            }
        };

    let reply = send_receive_token(
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
    .await;

    Ok(reply)
}

async fn transfer_from_token(
    request_id: u64,
    from_principal_id: &Account,
    token: &StableToken,
    amount: &Nat,
    to_principal_id: &Account,
    transfer_ids: &mut Vec<u64>,
    ts: u64,
) -> Result<(), String> {
    let token_id = token.token_id();

    request_map::update_status(request_id, StatusCode::SendPayToken, None);

    match icrc2_transfer_from(token, amount, from_principal_id, to_principal_id).await {
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
            transfer_ids.push(transfer_id);
            request_map::update_status(request_id, StatusCode::SendPayTokenSuccess, None);
            Ok(())
        }
        Err(e) => {
            request_map::update_status(request_id, StatusCode::SendPayTokenFailed, Some(&e));
            Err(e)
        }
    }
}

pub fn archive_to_kong_data(request: StableRequest) {
    request_map::archive_request_to_kong_data(request.request_id);
    if let Reply::Swap(reply) = request.reply {
        for claim_id in reply.claim_ids.iter() {
            claim_map::archive_claim_to_kong_data(*claim_id);
        }
        for transfer_id_reply in reply.transfer_ids.iter() {
            transfer_map::archive_transfer_to_kong_data(transfer_id_reply.transfer_id);
        }
        tx_map::archive_tx_to_kong_data(reply.tx_id);
    };
}
