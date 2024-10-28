use candid::Nat;
use num::{BigRational, Zero};
use num_traits::ToPrimitive;

use super::swap_args::SwapArgs;
use super::swap_calc::SwapCalc;
use super::swap_calc_impl::{get_slippage, swap_amount_0, swap_amount_1};
use super::swap_reply::SwapReply;

use crate::helpers::nat_helpers::nat_divide_as_f64;
use crate::helpers::{
    math_helpers::{price_rounded, round_f64},
    nat_helpers::{
        nat_add, nat_divide, nat_is_zero, nat_multiply, nat_multiply_f64, nat_subtract, nat_to_decimal_precision, nat_to_decimals_f64,
        nat_zero,
    },
};
use crate::ic::{
    address::Address,
    address_impl::get_address,
    ckusdt::is_ckusdt,
    get_time::get_time,
    icp::is_icp,
    id::caller_id,
    logging::error_log,
    transfer::{icp_transfer, icrc1_transfer},
    verify::verify_transfer,
};
use crate::stable_claim::{claim_map, stable_claim::StableClaim};
use crate::stable_kong_settings::kong_settings;
use crate::stable_pool::pool_map;
use crate::stable_request::{reply::Reply, request::Request, request_map, stable_request::StableRequest, status::StatusCode};
use crate::stable_token::{stable_token::StableToken, token::Token, token_map};
use crate::stable_transfer::{stable_transfer::StableTransfer, transfer_map, tx_id::TxId};
use crate::stable_tx::{stable_tx::StableTx, swap_tx::SwapTx, tx_map};
use crate::stable_user::user_map;

pub async fn swap_transfer(args: SwapArgs) -> Result<SwapReply, String> {
    // as user has transferred the pay token, we need to log the request immediately and verify the transfer
    // make sure user is registered, if not create a new user with referred_by if specified
    let user_id = user_map::insert(args.referred_by.as_deref())?;
    let ts = get_time();
    let request_id = request_map::insert(&StableRequest::new(user_id, &Request::Swap(args.clone()), ts));

    let error = match check_arguments(&args, request_id, ts).await {
        Ok((pay_token, pay_amount, transfer_id)) => {
            match process_swap(request_id, user_id, &pay_token, &pay_amount, transfer_id, &args, ts).await {
                Ok(reply) => {
                    request_map::update_status(request_id, StatusCode::Success, None);
                    return Ok(reply);
                }
                Err(e) => e,
            }
        }
        Err(e) => e,
    };

    request_map::update_status(request_id, StatusCode::Failed, None);
    Err(error)
}

pub async fn swap_transfer_async(args: SwapArgs) -> Result<u64, String> {
    let user_id = user_map::insert(args.referred_by.as_deref())?;
    let ts = get_time();
    let request_id = request_map::insert(&StableRequest::new(user_id, &Request::Swap(args.clone()), ts));

    ic_cdk::spawn(async move {
        if let Ok((pay_token, pay_amount, transfer_id)) = check_arguments(&args, request_id, ts).await {
            if (process_swap(request_id, user_id, &pay_token, &pay_amount, transfer_id, &args, ts).await).is_ok() {
                request_map::update_status(request_id, StatusCode::Success, None);
                return;
            }
        };

        request_map::update_status(request_id, StatusCode::Failed, None);
    });

    Ok(request_id)
}

/// check pay token is valid and verify the transfer
async fn check_arguments(args: &SwapArgs, request_id: u64, ts: u64) -> Result<(StableToken, Nat, u64), String> {
    // update the request status
    request_map::update_status(request_id, StatusCode::Start, None);

    // check pay_token is a valid token
    let pay_token = match token_map::get_by_token(&args.pay_token) {
        Ok(token) => token,
        Err(e) => {
            request_map::update_status(request_id, StatusCode::PayTokenNotFound, Some(e.clone()));
            return Err(e);
        }
    };
    let pay_amount = args.pay_amount.clone();

    // check pay_tx_id is valid block index
    match &args.pay_tx_id {
        Some(pay_tx_id) => match pay_tx_id {
            TxId::BlockIndex(pay_tx_id) => {
                let transfer_id = verify_transfer_token(request_id, &pay_token, pay_tx_id, &pay_amount, ts).await?;
                Ok((pay_token, pay_amount, transfer_id))
            }
            _ => {
                request_map::update_status(request_id, StatusCode::PayTxIdNotSupported, None);
                Err("Pay tx_id not supported".to_string())
            }
        },
        None => {
            request_map::update_status(request_id, StatusCode::PayTxIdNotFound, None);
            Err("Pay tx_id required".to_string())
        }
    }
}

fn calculate_amounts(
    user_id: u32,
    pay_token: &StableToken,
    pay_amount: &Nat,
    receive_token: &StableToken,
    user_receive_amount: Option<&Nat>,
    user_max_slippage: f64,
) -> Result<(Nat, f64, f64, f64, Vec<SwapCalc>), String> {
    // Pay token
    let pay_token_id = pay_token.token_id();
    // Receive token
    let receive_token_id = receive_token.token_id();
    let user_fee_level = user_map::get_by_user_id(user_id).ok_or("User not found")?.fee_level;

    let ckusdt = token_map::get_ckusdt()?;
    let receive_amount_with_fees_and_gas;
    let mid_price_f64;
    let price_f64;
    let slippage_f64;
    let mut txs = Vec::new();
    if is_ckusdt(&receive_token.address_with_chain()) {
        let pool = pool_map::get_by_token_ids(pay_token_id, receive_token_id).ok_or("Pool not found")?;
        let swap = swap_amount_0(&pool, pay_amount, Some(user_fee_level), None, None)?;
        receive_amount_with_fees_and_gas = swap.receive_amount_with_fees_and_gas();
        let mid_price = swap.get_mid_price().ok_or("Invalid mid price")?;
        mid_price_f64 = price_rounded(&mid_price).ok_or("Invalid mid price")?;
        let price = swap.get_price().ok_or("Invalid price")?;
        price_f64 = price_rounded(&price).ok_or("Invalid price")?;
        slippage_f64 = get_slippage(&price, &mid_price).ok_or("Invalid slippage")?;
        txs.push(swap);
    } else if is_ckusdt(&pay_token.address_with_chain()) {
        let pool = pool_map::get_by_token_ids(receive_token_id, pay_token_id).ok_or("Pool not found")?;
        let swap = swap_amount_1(&pool, pay_amount, Some(user_fee_level), None, None)?;
        receive_amount_with_fees_and_gas = swap.receive_amount_with_fees_and_gas();
        let mid_price = swap.get_mid_price().ok_or("Invalid mid price")?;
        mid_price_f64 = price_rounded(&mid_price).ok_or("Invalid mid price")?;
        let price = swap.get_price().ok_or("Invalid price")?;
        price_f64 = price_rounded(&price).ok_or("Invalid price")?;
        slippage_f64 = get_slippage(&price, &mid_price).ok_or("Invalid slippage")?;
        txs.push(swap);
    } else {
        // 2-step swap via ckUSDT
        let pool1 = pool_map::get_by_token_ids(pay_token.token_id(), ckusdt.token_id()).ok_or("Pool not found")?;
        let swap1_lp_fee = (pool1.lp_fee_bps + 1) / 2; // this will round it up
        let swap1 = swap_amount_0(
            &pool1,
            pay_amount,
            Some(user_fee_level),
            Some(swap1_lp_fee),
            Some(&nat_zero()), // swap1 do not take gas fees
        )?;
        let pool2 = pool_map::get_by_token_ids(receive_token.token_id(), ckusdt.token_id()).ok_or("Pool not found")?;
        let swap2_lp_fee = (pool2.lp_fee_bps + 1) / 2;
        let swap2 = swap_amount_1(
            &pool2,
            &swap1.receive_amount_with_fees_and_gas(),
            Some(user_fee_level),
            Some(swap2_lp_fee),
            None,
        )?;
        receive_amount_with_fees_and_gas = swap2.receive_amount_with_fees_and_gas();
        let swap1_mid_price = swap1.get_mid_price().ok_or("Invalid swap1 mid price")?;
        let swap2_mid_price = swap2.get_mid_price().ok_or("Invalid swap2 mid price")?;
        let mid_price = swap1_mid_price * swap2_mid_price;
        mid_price_f64 = price_rounded(&mid_price).ok_or("Invalid mid price")?;
        let swap1_price = swap1.get_price().ok_or("Invalid swap1 price")?;
        let swap2_price = swap2.get_price().ok_or("Invalid swap2 price")?;
        let price = swap1_price * swap2_price;
        price_f64 = price_rounded(&price).ok_or("Invalid price")?;
        slippage_f64 = get_slippage(&price, &mid_price).ok_or("Invalid slippage")?;
        txs.push(swap1);
        txs.push(swap2);
    }

    // check if receive_amount is within user's specified
    if let Some(user_receive_amount) = user_receive_amount {
        if receive_amount_with_fees_and_gas < *user_receive_amount {
            let decimals = receive_token.decimals();
            let receive_amount_with_fees_and_gas_f64 = round_f64(
                nat_to_decimals_f64(decimals, &receive_amount_with_fees_and_gas).unwrap_or(0_f64),
                decimals,
            );
            return Err(format!(
                "Insufficient receive amount. Can only receive {} {} with {}% slippage",
                receive_amount_with_fees_and_gas_f64,
                receive_token.symbol(),
                slippage_f64
            ));
        }
    }

    // check if slippage is within user's specified
    if slippage_f64 > user_max_slippage {
        let decimals = receive_token.decimals();
        let receive_amount_with_fees_and_gas_f64 = round_f64(
            nat_to_decimals_f64(decimals, &receive_amount_with_fees_and_gas).unwrap_or(0_f64),
            decimals,
        );
        return Err(format!(
            "Slippage exceeded. Can only receive {} {} with {}% slippage",
            receive_amount_with_fees_and_gas_f64,
            receive_token.symbol(),
            slippage_f64
        ));
    }

    Ok((receive_amount_with_fees_and_gas, mid_price_f64, price_f64, slippage_f64, txs))
}

async fn process_swap(
    request_id: u64,
    user_id: u32,
    pay_token: &StableToken,
    pay_amount: &Nat,
    pay_transfer_id: u64,
    args: &SwapArgs,
    ts: u64,
) -> Result<SwapReply, String> {
    // empty vector to store the block ids of the on-chain transfers
    let mut transfer_ids = Vec::new();
    transfer_ids.push(pay_transfer_id);

    let receive_token = match token_map::get_by_token(&args.receive_token) {
        Ok(token) => token,
        Err(e) => {
            request_map::update_status(request_id, StatusCode::ReceiveTokenNotFound, None);
            // return pay token back to user
            return_pay_token(request_id, user_id, pay_token, pay_amount, None, &mut transfer_ids, ts).await;
            let error = format!("Swap #{} failed: {}", request_id, e);
            return Err(error);
        }
    };
    let receive_amount = args.receive_amount.as_ref();
    if nat_is_zero(pay_amount) {
        request_map::update_status(request_id, StatusCode::PayTokenAmountIsZero, None);
        // return pay token back to user
        return_pay_token(
            request_id,
            user_id,
            pay_token,
            pay_amount,
            Some(&receive_token),
            &mut transfer_ids,
            ts,
        )
        .await;
        return Err("Swap #{} failed: Pay amount is zero".to_string());
    }
    // use specified max slippage or use default
    let max_slippage = args.max_slippage.unwrap_or(kong_settings::get().default_max_slippage);
    // use specified address or default to caller's principal id
    let to_address = match args.receive_address {
        Some(ref address) => match get_address(address) {
            Some(address) => address,
            None => {
                request_map::update_status(request_id, StatusCode::ReceiveAddressNotFound, None);
                // return pay token back to user
                return_pay_token(
                    request_id,
                    user_id,
                    pay_token,
                    pay_amount,
                    Some(&receive_token),
                    &mut transfer_ids,
                    ts,
                )
                .await;
                let error = format!("Swap #{} failed: Invalid receive address", request_id);
                return Err(error);
            }
        },
        None => Address::PrincipalId(caller_id()),
    };

    match update_liquidity_pool(
        request_id,
        user_id,
        pay_token,
        pay_amount,
        &receive_token,
        receive_amount,
        max_slippage,
    ) {
        Ok((receive_amount, mid_price, price, slippage, swaps)) => Ok(send_receive_token(
            request_id,
            user_id,
            pay_token,
            pay_amount,
            &receive_token,
            &receive_amount,
            &to_address,
            &mut transfer_ids,
            mid_price,
            price,
            slippage,
            &swaps,
            ts,
        )
        .await),
        Err(e) => {
            return_pay_token(
                request_id,
                user_id,
                pay_token,
                pay_amount,
                Some(&receive_token),
                &mut transfer_ids,
                ts,
            )
            .await;
            let error = format!("Swap #{} failed: {}", request_id, e);
            Err(error)
        }
    }
}

async fn verify_transfer_token(request_id: u64, token: &StableToken, tx_id: &Nat, amount: &Nat, ts: u64) -> Result<u64, String> {
    let symbol = token.symbol();
    let token_id = token.token_id();

    request_map::update_status(request_id, StatusCode::VerifyPayToken, None);

    // verify the transfer
    match verify_transfer(token, tx_id, amount).await {
        Ok(_) => {
            // contain() will use the latest state of TRANSFER_MAP to prevent reentrancy issues after verify_transfer()
            if transfer_map::contain(token_id, tx_id) {
                let error = format!("Swap #{} failed to verify tx {} #{}: duplicate block id", request_id, symbol, tx_id);
                request_map::update_status(request_id, StatusCode::VerifyPayTokenFailed, Some("Duplicate block id".to_string()));
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
            request_map::update_status(request_id, StatusCode::VerifyPayTokenSuccess, None);
            Ok(transfer_id)
        }
        Err(e) => {
            let error = format!("Swap #{} failed to verify tx {} #{}: {}", request_id, symbol, tx_id, e);
            request_map::update_status(request_id, StatusCode::VerifyPayTokenFailed, Some(e));
            Err(error)
        }
    }
}

fn update_liquidity_pool(
    request_id: u64,
    user_id: u32,
    pay_token: &StableToken,
    pay_amount: &Nat,
    receive_token: &StableToken,
    receive_amount: Option<&Nat>,
    max_slippage: f64,
) -> Result<(Nat, f64, f64, f64, Vec<SwapCalc>), String> {
    request_map::update_status(request_id, StatusCode::CalculatePoolAmounts, None);

    match calculate_amounts(user_id, pay_token, pay_amount, receive_token, receive_amount, max_slippage) {
        Ok((receive_amount, mid_price, price, slippage, swaps)) => {
            request_map::update_status(request_id, StatusCode::CalculatePoolAmountsSuccess, None);

            // update the pool, in some cases there could be multiple pools
            request_map::update_status(request_id, StatusCode::UpdatePoolAmounts, None);
            for swap in &swaps {
                // refresh pool with the latest state
                let mut pool = match pool_map::get_by_pool_id(swap.pool_id) {
                    Some(pool) => pool,
                    None => continue, // should not get here
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
                "Swap #{} Kong failed to send {} {}: {}",
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
                "Swap #{} Kong failed to return {} {}: {}",
                request_id, pay_amount, pay_symbol, message
            ));

            request_map::update_status(request_id, StatusCode::ReturnPayTokenFailed, Some(message));
        }
    };

    let reply = SwapReply::new_failed(request_id, pay_token, pay_amount, receive_token, transfer_ids, &claim_ids, ts);
    request_map::update_reply(request_id, Reply::Swap(reply));
}
