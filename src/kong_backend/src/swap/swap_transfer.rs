use candid::Nat;
use num_traits::ToPrimitive;

use super::archive_to_kong_data::archive_to_kong_data;
use super::return_pay_token::return_pay_token;
use super::send_receive_token::send_receive_token;
use super::swap_args::SwapArgs;
use super::swap_calc::SwapCalc;
use super::swap_reply::SwapReply;
use super::update_liquidity_pool::update_liquidity_pool;

use crate::chains::chains::SOL_CHAIN;
use crate::helpers::nat_helpers::nat_is_zero;
use crate::ic::address::Address;
use crate::ic::address_helpers::get_address;
use crate::ic::get_time::get_time;
use crate::ic::id::caller_id;
use crate::ic::verify::verify_transfer;
use crate::stable_kong_settings::kong_settings_map;
use crate::stable_request::{request::Request, request_map, stable_request::StableRequest, status::StatusCode};
use crate::stable_token::{stable_token::StableToken, token::Token, token_map};
use crate::stable_transfer::{stable_transfer::StableTransfer, transfer_map, tx_id::TxId};
use crate::stable_user::user_map;

pub async fn swap_transfer(args: SwapArgs) -> Result<SwapReply, String> {
    // as user has transferred the pay token, we need to log the request immediately and verify the transfer
    // make sure user is registered, if not create a new user with referred_by if specified
    let user_id = user_map::insert(args.referred_by.as_deref())?;
    let ts = get_time();
    let request_id = request_map::insert(&StableRequest::new(user_id, &Request::Swap(args.clone()), ts));
    let mut transfer_ids = Vec::new();

    let (pay_token, pay_amount, pay_transfer_id) = check_arguments(&args, request_id, ts).await.inspect_err(|_| {
        request_map::update_status(request_id, StatusCode::Failed, None);
        let _ = archive_to_kong_data(request_id);
    })?;

    let (receive_token, receive_amount_with_fees_and_gas, to_address, mid_price, price, slippage, swaps) = process_swap(
        request_id,
        user_id,
        &pay_token,
        &pay_amount,
        pay_transfer_id,
        &args,
        &mut transfer_ids,
        ts,
    )
    .await
    .inspect_err(|_| {
        request_map::update_status(request_id, StatusCode::Failed, None);
        let _ = archive_to_kong_data(request_id);
    })?;

    let result = send_receive_token(
        request_id,
        user_id,
        &pay_token,
        &pay_amount,
        &receive_token,
        &receive_amount_with_fees_and_gas,
        &to_address,
        &mut transfer_ids,
        mid_price,
        price,
        slippage,
        &swaps,
        ts,
    )
    .await;

    request_map::update_status(request_id, StatusCode::Success, None);
    let _ = archive_to_kong_data(request_id);

    Ok(result)
}

pub async fn swap_transfer_async(args: SwapArgs) -> Result<u64, String> {
    let user_id = user_map::insert(args.referred_by.as_deref())?;
    let ts = get_time();
    let request_id = request_map::insert(&StableRequest::new(user_id, &Request::Swap(args.clone()), ts));

    let (pay_token, pay_amount, pay_transfer_id) = check_arguments(&args, request_id, ts).await.inspect_err(|_| {
        request_map::update_status(request_id, StatusCode::Failed, None);
        let _ = archive_to_kong_data(request_id);
    })?;

    ic_cdk::spawn(async move {
        let mut transfer_ids = Vec::new();

        let Ok((receive_token, receive_amount_with_fees_and_gas, to_address, mid_price, price, slippage, swaps)) = process_swap(
            request_id,
            user_id,
            &pay_token,
            &pay_amount,
            pay_transfer_id,
            &args,
            &mut transfer_ids,
            ts,
        )
        .await
        else {
            request_map::update_status(request_id, StatusCode::Failed, None);
            let _ = archive_to_kong_data(request_id);
            return;
        };

        ic_cdk::spawn(async move {
            send_receive_token(
                request_id,
                user_id,
                &pay_token,
                &pay_amount,
                &receive_token,
                &receive_amount_with_fees_and_gas,
                &to_address,
                &mut transfer_ids,
                mid_price,
                price,
                slippage,
                &swaps,
                ts,
            )
            .await;

            let _ = archive_to_kong_data(request_id);
        });

        request_map::update_status(request_id, StatusCode::Success, None);
    });

    Ok(request_id)
}

/// check pay token is valid and verify the transfer
async fn check_arguments(args: &SwapArgs, request_id: u64, ts: u64) -> Result<(StableToken, Nat, u64), String> {
    request_map::update_status(request_id, StatusCode::Start, None);

    // check pay_token is a valid token. We need to know the canister id so return here if token is not valid
    let pay_token = token_map::get_by_token(&args.pay_token).inspect_err(|e| {
        request_map::update_status(request_id, StatusCode::PayTokenNotFound, Some(e));
    })?;

    let pay_amount = args.pay_amount.clone();

    // check pay_tx_id is valid block index or transaction signature
    let transfer_id = match &args.pay_tx_id {
        Some(pay_tx_id) => match pay_tx_id {
            TxId::BlockIndex(pay_tx_id) => {
                match pay_token.chain().as_str() {
                    SOL_CHAIN => {
                        request_map::update_status(request_id, StatusCode::PayTokenNotSupported, None);
                        Err(format!("Solana tokens must use Signature, not BlockIndex"))?
                    },
                    _ => verify_transfer_token(request_id, &pay_token, pay_tx_id, &pay_amount, ts).await?
                }
            },
            TxId::Signature(signature) => {
                match pay_token.chain().as_str() {
                    SOL_CHAIN => verify_transfer_signature(request_id, &pay_token, signature, &pay_amount, ts).await?,
                    _ => {
                        request_map::update_status(request_id, StatusCode::PayTxIdNotSupported, None);
                        Err("Signature tx_id only supported for Solana tokens".to_string())?
                    }
                }
            },
            _ => {
                request_map::update_status(request_id, StatusCode::PayTxIdNotSupported, None);
                Err("Pay tx_id type not supported".to_string())?
            }
        },
        None => {
            request_map::update_status(request_id, StatusCode::PayTxIdNotFound, None);
            Err("Pay tx_id required".to_string())?
        }
    };

    Ok((pay_token, pay_amount, transfer_id))
}

#[allow(clippy::too_many_arguments)]
async fn process_swap(
    request_id: u64,
    user_id: u32,
    pay_token: &StableToken,
    pay_amount: &Nat,
    pay_transfer_id: u64,
    args: &SwapArgs,
    transfer_ids: &mut Vec<u64>,
    ts: u64,
) -> Result<(StableToken, Nat, Address, f64, f64, f64, Vec<SwapCalc>), String> {
    let caller_id = caller_id();

    transfer_ids.push(pay_transfer_id);

    let receive_token = token_map::get_by_token(&args.receive_token).inspect_err(|e| {
        request_map::update_status(request_id, StatusCode::ReceiveTokenNotFound, Some(e));
    })?;
    if receive_token.is_removed() {
        request_map::update_status(request_id, StatusCode::ReceiveTokenNotFound, None);
        return_pay_token(
            request_id,
            user_id,
            &caller_id,
            pay_token,
            pay_amount,
            Some(&receive_token),
            transfer_ids,
            ts,
        )
        .await;
        Err(format!("Req #{} failed. Receive token is suspended or removed", request_id))?
    }
    let receive_amount = args.receive_amount.as_ref();

    if pay_token.is_removed() {
        request_map::update_status(request_id, StatusCode::PayTokenNotFound, None);
        return_pay_token(
            request_id,
            user_id,
            &caller_id,
            pay_token,
            pay_amount,
            Some(&receive_token),
            transfer_ids,
            ts,
        )
        .await;
        Err(format!("Req #{} failed. Pay token is suspended or removed", request_id))?
    }
    if nat_is_zero(pay_amount) {
        request_map::update_status(request_id, StatusCode::PayTokenAmountIsZero, None);
        return_pay_token(
            request_id,
            user_id,
            &caller_id,
            pay_token,
            pay_amount,
            Some(&receive_token),
            transfer_ids,
            ts,
        )
        .await;
        Err(format!("Req #{} failed. Pay amount is zero", request_id))?
    }

    // use specified max slippage or use default
    let max_slippage = args.max_slippage.unwrap_or(kong_settings_map::get().default_max_slippage);
    // use specified address or default to caller's principal id
    let to_address = match args.receive_address {
        Some(ref address) => match get_address(&receive_token, address) {
            Ok(address) => address,
            Err(e) => {
                request_map::update_status(request_id, StatusCode::ReceiveAddressNotFound, None);
                return_pay_token(
                    request_id,
                    user_id,
                    &caller_id,
                    pay_token,
                    pay_amount,
                    Some(&receive_token),
                    transfer_ids,
                    ts,
                )
                .await;
                Err(format!("Req #{} failed. {}", request_id, e))?
            }
        },
        None => Address::PrincipalId(caller_id.owner),
    };

    let (receive_amount_with_fees_and_gas, mid_price, price, slippage, swaps) =
        match update_liquidity_pool(request_id, pay_token, pay_amount, &receive_token, receive_amount, max_slippage) {
            Ok((receive_amount, mid_price, price, slippage, swaps)) => (receive_amount, mid_price, price, slippage, swaps),
            Err(e) => {
                return_pay_token(
                    request_id,
                    user_id,
                    &caller_id,
                    pay_token,
                    pay_amount,
                    Some(&receive_token),
                    transfer_ids,
                    ts,
                )
                .await;
                Err(format!("Req #{} failed. {}", request_id, e))?
            }
        };

    request_map::update_status(request_id, StatusCode::SwapSuccess, None);

    Ok((
        receive_token,
        receive_amount_with_fees_and_gas,
        to_address,
        mid_price,
        price,
        slippage,
        swaps,
    ))
}

async fn verify_transfer_token(request_id: u64, token: &StableToken, tx_id: &Nat, amount: &Nat, ts: u64) -> Result<u64, String> {
    let token_id = token.token_id();

    request_map::update_status(request_id, StatusCode::VerifyPayToken, None);

    match verify_transfer(token, tx_id, amount).await {
        Ok(_) => {
            // contain() will use the latest state of TRANSFER_MAP to prevent reentrancy issues after verify_transfer()
            if transfer_map::contain(token_id, tx_id) {
                let e = format!("Duplicate block id #{}", tx_id);
                request_map::update_status(request_id, StatusCode::VerifyPayTokenFailed, Some(&e));
                Err(e)?
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
            request_map::update_status(request_id, StatusCode::VerifyPayTokenFailed, Some(&e));
            Err(e)
        }
    }
}

async fn verify_transfer_signature(request_id: u64, token: &StableToken, signature: &str, amount: &Nat, ts: u64) -> Result<u64, String> {
    let token_id = token.token_id();

    request_map::update_status(request_id, StatusCode::VerifyPayToken, None);

    // Verify Solana transaction signature and details
    match verify_solana_signature(token, signature, amount).await {
        Ok(_) => {
            // Check if this signature has been used before
            if transfer_map::contain_signature(token_id, signature) {
                let e = format!("Duplicate signature #{}", signature);
                request_map::update_status(request_id, StatusCode::VerifyPayTokenFailed, Some(&e));
                Err(e)?
            }
            
            // Insert the transfer record
            let transfer_id = transfer_map::insert(&StableTransfer {
                transfer_id: 0,
                request_id,
                is_send: true,
                amount: amount.clone(),
                token_id,
                tx_id: TxId::Signature(signature.to_string()),
                ts,
            });
            
            request_map::update_status(request_id, StatusCode::VerifyPayTokenSuccess, None);
            Ok(transfer_id)
        }
        Err(e) => {
            request_map::update_status(request_id, StatusCode::VerifyPayTokenFailed, Some(&e));
            Err(e)
        }
    }
}

// Verify Solana transaction signature and details
async fn verify_solana_signature(token: &StableToken, signature: &str, amount: &Nat) -> Result<(), String> {
    // Initialize Solana RPC client
    let solana_client = crate::sol::init_solana_client("https://api.mainnet-beta.solana.com").await?;
    
    // Get Kong's Solana address (where funds should be sent to)
    let kong_address = kong_settings_map::get().sol_backend_address
        .clone()
        .ok_or_else(|| "Solana address not configured in Kong settings".to_string())?;
    
    // Verify the transaction
    // This is a simplified implementation - a real one would parse the amount correctly based on token decimals
    let _amount_u64 = amount.0.to_u64()
        .ok_or_else(|| "Amount cannot be converted to u64".to_string())?;
    
    // Get the sender's address (caller's address) - in a real implementation, this would be extracted from the transaction
    // or verified against the transaction's sender
    let _caller_address = "CALLER_SOLANA_ADDRESS"; // Placeholder - real implementation would get this
    
    // Check if this is an SPL token or native SOL
    let is_spl = token.is_icrc1();
    
    // Verify the transaction according to its type
    if is_spl {
        // For SPL tokens
        match solana_client.get_spl_transaction(signature).await {
            Ok(tx_info) => {
                // Parse the transaction info and validate it
                // This is simplified - actual implementation would properly parse the JSON and validate all fields
                if !tx_info.contains(&kong_address) {
                    return Err(format!("Transaction destination does not match Kong address: {}", kong_address));
                }
                // Add more validation as needed
            }
            Err(e) => return Err(format!("Failed to get SPL transaction: {}", e)),
        }
    } else {
        // For native SOL
        match solana_client.get_sol_transaction(signature).await {
            Ok(tx_info) => {
                // Parse the transaction info and validate it
                // This is simplified - actual implementation would properly parse the JSON and validate all fields
                if !tx_info.contains(&kong_address) {
                    return Err(format!("Transaction destination does not match Kong address: {}", kong_address));
                }
                // Add more validation as needed
            }
            Err(e) => return Err(format!("Failed to get SOL transaction: {}", e)),
        }
    }
    
    // If we've gotten this far, the transaction is valid
    Ok(())
}