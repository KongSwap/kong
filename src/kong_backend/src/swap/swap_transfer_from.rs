use candid::Nat;
use num::{BigRational, Zero};
use num_traits::ToPrimitive;

use super::swap_amounts::swap_amounts;
use super::swap_args::SwapArgs;
use super::swap_calc::SwapCalc;
use super::swap_reply::SwapReply;

use crate::helpers::nat_helpers::nat_divide_as_f64;
use crate::helpers::{
    math_helpers::round_f64,
    nat_helpers::{
        nat_add, nat_divide, nat_is_zero, nat_multiply, nat_multiply_f64, nat_subtract, nat_to_decimal_precision, nat_to_decimals_f64,
        nat_zero,
    },
};
use crate::ic::{
    address::Address,
    address_impl::get_address,
    get_time::get_time,
    id::caller_id,
    logging::error_log,
    transfer::{icp_transfer, icrc1_transfer, icrc2_transfer_from},
};
use crate::stable_claim::{claim_map, stable_claim::StableClaim};
use crate::stable_kong_settings::kong_settings;
use crate::stable_pool::pool_map;
use crate::stable_request::{reply::Reply, request::Request, request_map, stable_request::StableRequest, status::StatusCode};
use crate::stable_token::{stable_token::StableToken, token::Token, token_map};
use crate::stable_transfer::{stable_transfer::StableTransfer, transfer_map, tx_id::TxId};
use crate::stable_tx::{stable_tx::StableTx, swap_tx::SwapTx, tx_map};
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

fn calculate_amounts(
    pay_token: &StableToken,
    pay_amount: &Nat,
    receive_token: &StableToken,
    user_receive_amount: Option<&Nat>,
    user_max_slippage: f64,
) -> Result<(Nat, f64, f64, f64, Vec<SwapCalc>), String> {
    let (receive_amount, price, mid_price, slippage, txs) = swap_amounts(pay_token, pay_amount, receive_token)?;

    // check if receive_amount is within user's specified
    if let Some(user_receive_amount) = user_receive_amount {
        if receive_amount < *user_receive_amount {
            let decimals = receive_token.decimals();
            let receive_amount_with_fees_and_gas_f64 = round_f64(nat_to_decimals_f64(decimals, &receive_amount).unwrap_or(0_f64), decimals);
            return Err(format!(
                "Insufficient receive amount. Can only receive {} {} with {}% slippage",
                receive_amount_with_fees_and_gas_f64,
                receive_token.symbol(),
                slippage
            ));
        }
    }

    // check if slippage is within user's specified
    if slippage > user_max_slippage {
        let decimals = receive_token.decimals();
        let receive_amount_with_fees_and_gas_f64 = round_f64(nat_to_decimals_f64(decimals, &receive_amount).unwrap_or(0_f64), decimals);
        return Err(format!(
            "Slippage exceeded. Can only receive {} {} with {}% slippage",
            receive_amount_with_fees_and_gas_f64,
            receive_token.symbol(),
            slippage
        ));
    }

    Ok((receive_amount, mid_price, price, slippage, txs))
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

fn update_liquidity_pool(
    request_id: u64,
    pay_token: &StableToken,
    pay_amount: &Nat,
    receive_token: &StableToken,
    receive_amount: Option<&Nat>,
    max_slippage: f64,
) -> Result<(Nat, f64, f64, f64, Vec<SwapCalc>), String> {
    request_map::update_status(request_id, StatusCode::CalculatePoolAmounts, None);

    match calculate_amounts(pay_token, pay_amount, receive_token, receive_amount, max_slippage) {
        Ok((receive_amount, price, mid_price, slippage, swaps)) => {
            request_map::update_status(request_id, StatusCode::CalculatePoolAmountsSuccess, None);

            // update the pool, in some cases there could be multiple pools
            request_map::update_status(request_id, StatusCode::UpdatePoolAmounts, None);
            for swap in &swaps {
                // refresh pool with the latest state
                let mut pool = match pool_map::get_by_pool_id(swap.pool_id) {
                    Some(pool) => pool,
                    None => {
                        // should not get here
                        let error = format!("Swap #{} failed: pool not found", request_id);
                        error_log(&error);
                        continue;
                    }
                };

                if swap.receive_token_id == pool.token_id_1 {
                    // user pays token_0 and receives token_1
                    pool.balance_0 = nat_add(&pool.balance_0, &swap.pay_amount); // pay_amount is in token_0
                    pool.balance_1 = nat_subtract(&pool.balance_1, &swap.receive_amount).unwrap_or(nat_zero()); // receive_amount is in token_1
                    pool.total_volume = nat_add(&pool.total_volume, &swap.receive_amount); // receive_amount is in token_1
                                                                                           // take out Kong's fee
                                                                                           // kong_fee_1 = lp_fee * kong_fee_bps / lp_fee_bps
                                                                                           // lp_fee_1 = lp_fee - kong_fee_1
                    let numerator = nat_multiply(&swap.lp_fee, &Nat::from(pool.kong_fee_bps)); //swap.lp_fee is in token_1
                    let kong_fee_1 = nat_divide(&numerator, &Nat::from(pool.lp_fee_bps)).unwrap_or(nat_zero());
                    let lp_fee_1 = nat_subtract(&swap.lp_fee, &kong_fee_1).unwrap_or(nat_zero());
                    pool.lp_fee_1 = nat_add(&pool.lp_fee_1, &lp_fee_1);
                    pool.kong_fee_1 = nat_add(&pool.kong_fee_1, &kong_fee_1);
                    pool.total_lp_fee = nat_add(&pool.total_lp_fee, &lp_fee_1);

                    // update 24h stats
                    pool.rolling_24h_volume = nat_add(&pool.rolling_24h_volume, &swap.receive_amount);
                    pool.rolling_24h_lp_fee = nat_add(&pool.rolling_24h_lp_fee, &swap.lp_fee);
                } else {
                    // user pays token_1 and receives token_0
                    pool.balance_0 = nat_subtract(&pool.balance_0, &swap.receive_amount).unwrap_or(nat_zero()); // receive_amount is in token_0
                    pool.balance_1 = nat_add(&pool.balance_1, &swap.pay_amount); // pay_amount is in token_1
                    pool.total_volume = nat_add(&pool.total_volume, &swap.pay_amount); // pay_amount is in token_1
                                                                                       // take out Kong's fee
                                                                                       // kong_fee_0 = lp_fee * kong_fee_bps / lp_fee_bps
                                                                                       // lp_fee_0 = lp_fee - kong_fee_0
                    let numerator = nat_multiply(&swap.lp_fee, &Nat::from(pool.kong_fee_bps)); //swap.lp_fee is in token_0
                    let kong_fee_0 = nat_divide(&numerator, &Nat::from(pool.lp_fee_bps)).unwrap_or(nat_zero());
                    let lp_fee_0 = nat_subtract(&swap.lp_fee, &kong_fee_0).unwrap_or(nat_zero());
                    pool.lp_fee_0 = nat_add(&pool.lp_fee_0, &lp_fee_0);
                    pool.kong_fee_0 = nat_add(&pool.kong_fee_0, &kong_fee_0);

                    // lp_fee_0 is denominated in token_0. total_lp_fee is denominated in token_1
                    // need to convert swap.lp_fee to token_1
                    let token_0 = pool.token_0();
                    let token_1 = pool.token_1();
                    let lp_fee_0_in_token_1_decimals = nat_to_decimal_precision(&lp_fee_0, token_0.decimals(), token_1.decimals());
                    let mid_price = swap.get_mid_price().unwrap_or(BigRational::zero());
                    let inv_price = if mid_price.is_zero() {
                        0_f64
                    } else {
                        // 1 / mid_price
                        mid_price.recip().to_f64().unwrap_or(0_f64)
                    };
                    let lp_fee_0_in_token_1_decimals = nat_multiply_f64(&lp_fee_0_in_token_1_decimals, inv_price).unwrap_or(nat_zero());
                    pool.total_lp_fee = nat_add(&pool.total_lp_fee, &lp_fee_0_in_token_1_decimals);

                    // update 24h stats
                    pool.rolling_24h_volume = nat_add(&pool.rolling_24h_volume, &swap.pay_amount);
                    pool.rolling_24h_lp_fee = nat_add(&pool.rolling_24h_lp_fee, &lp_fee_0_in_token_1_decimals);
                }

                pool.rolling_24h_num_swaps = nat_add(&pool.rolling_24h_num_swaps, &Nat::from(1_u128));
                // APY = (total_fees / total_liquidity) * 365 * 100
                pool.rolling_24h_apy = round_f64(
                    nat_divide_as_f64(&pool.rolling_24h_lp_fee, &pool.get_balance()).unwrap_or(0_f64) * 365_f64 * 100_f64,
                    2,
                );

                // update pool
                pool_map::update(&pool);
            }

            request_map::update_status(request_id, StatusCode::UpdatePoolAmountsSuccess, None);

            Ok((receive_amount, mid_price, price, slippage, swaps))
        }
        Err(e) => {
            request_map::update_status(request_id, StatusCode::CalculatePoolAmountsFailed, Some(e.clone()));
            Err(e)
        }
    }
}

#[allow(clippy::too_many_arguments)]
async fn send_receive_token(
    request_id: u64,
    user_id: u32,
    pay_token: &StableToken,
    pay_amount: &Nat,
    receive_token: &StableToken,
    receive_amount: &Nat,
    to_address: &Address,
    transfer_ids: &mut Vec<u64>,
    mid_price: f64,
    price: f64,
    slippage: f64,
    txs: &[SwapCalc],
    ts: u64,
) -> SwapReply {
    let mut claim_ids = Vec::new();

    request_map::update_status(request_id, StatusCode::SendReceiveToken, None);

    // send ICP using icp_transfer or ICRC1 using icrc1_transfer
    match match to_address {
        Address::AccountId(to_account_id) => icp_transfer(receive_amount, to_account_id, receive_token, None).await,
        Address::PrincipalId(to_principal_id) => icrc1_transfer(receive_amount, to_principal_id, receive_token, None).await,
    } {
        Ok(tx_id) => {
            // insert_transfer() will use the latest state of DEPOSIT_MAP so no reentrancy issues after icp_transfer() or icrc1_transfer()
            let transfer_id = transfer_map::insert(&StableTransfer {
                transfer_id: 0,
                request_id,
                is_send: false,
                amount: receive_amount.clone(),
                token_id: receive_token.token_id(),
                tx_id: TxId::BlockIndex(tx_id),
                ts,
            });
            transfer_ids.push(transfer_id);
            request_map::update_status(request_id, StatusCode::SendReceiveTokenSuccess, None);
        }
        Err(e) => {
            let claim_id = claim_map::insert(&StableClaim::new(
                user_id,
                receive_token.token_id(),
                receive_amount,
                Some(request_id),
                Some(to_address.clone()),
                ts,
            ));
            claim_ids.push(claim_id);
            let message = format!("{} Saved as claim #{}", e, claim_id);
            error_log(&format!(
                "Swap Req #{} Kong failed to send {} {}: {}",
                request_id,
                receive_amount,
                receive_token.symbol(),
                message
            ));
            request_map::update_status(request_id, StatusCode::SendReceiveTokenFailed, Some(message));
        }
    }

    let swap_tx = SwapTx::new_success(
        user_id,
        request_id,
        pay_token.token_id(),
        pay_amount,
        receive_token.token_id(),
        receive_amount,
        mid_price,
        price,
        slippage,
        txs,
        transfer_ids,
        &claim_ids,
        ts,
    );
    // insert tx
    let tx_id = tx_map::insert(&StableTx::Swap(swap_tx.clone()));
    let reply = SwapReply::new_with_tx_id(tx_id, &swap_tx);
    request_map::update_reply(request_id, Reply::Swap(reply.clone()));
    reply
}

async fn return_pay_token(
    request_id: u64,
    user_id: u32,
    pay_token: &StableToken,
    pay_amount: &Nat,
    receive_token: Option<&StableToken>,
    transfer_ids: &mut Vec<u64>,
    ts: u64,
) {
    // Pay Token
    let pay_symbol = pay_token.symbol();

    let caller_id = caller_id();
    let mut claim_ids = Vec::new();

    request_map::update_status(request_id, StatusCode::ReturnPayToken, None);

    let pay_amount_with_gas = nat_subtract(pay_amount, &pay_token.fee()).unwrap_or(nat_zero());
    match icrc1_transfer(&pay_amount_with_gas, &caller_id, pay_token, None).await {
        Ok(tx_id) => {
            let transfer_id = transfer_map::insert(&StableTransfer {
                transfer_id: 0,
                request_id,
                is_send: false,
                amount: pay_amount_with_gas,
                token_id: pay_token.token_id(),
                tx_id: TxId::BlockIndex(tx_id),
                ts,
            });
            transfer_ids.push(transfer_id);
            request_map::update_status(request_id, StatusCode::ReturnPayTokenSuccess, None);
        }
        Err(e) => {
            let claim_id = claim_map::insert(&StableClaim::new(
                user_id,
                pay_token.token_id(),
                pay_amount,
                Some(request_id),
                Some(Address::PrincipalId(caller_id)),
                ts,
            ));
            claim_ids.push(claim_id);
            let message = format!("{} Saved as claim #{}", e, claim_id);
            error_log(&format!(
                "Swap Req #{} Kong failed to return {} {}: {}",
                request_id, pay_amount, pay_symbol, message
            ));
            request_map::update_status(request_id, StatusCode::ReturnPayTokenFailed, Some(message));
        }
    };

    let reply = SwapReply::new_failed(request_id, pay_token, pay_amount, receive_token, transfer_ids, &claim_ids, ts);
    request_map::update_reply(request_id, Reply::Swap(reply));
}
