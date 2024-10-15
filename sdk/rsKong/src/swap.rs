use anyhow::Result;
use candid::Nat;
use rand::rngs::ThreadRng;
use rand::Rng;
use tokio::time::{timeout, Duration};

use crate::kong_backend::helpers::nat_helpers::{nat_10pow, nat_divide_as_f64};
use crate::kong_backend::requests::requests_reply::Reply;
use crate::kong_backend::swap::swap_args::SwapArgs;
use crate::kong_backend::swap::swap_reply::SwapReply;
use crate::kong_backend::tokens::token::Token;
use crate::kong_backend::KongBackend;

pub async fn swap(
    rng: &mut ThreadRng,
    kong_backend: &KongBackend,
    symbol_0: &str,
    (min_amount_0, max_amount_0): (u64, u64),
    symbol_1: &str,
) -> Result<SwapReply> {
    let pay_token = kong_backend
        .token(symbol_0)
        .ok_or(anyhow::anyhow!("Token {} not found", symbol_0))?;
    let pay_amount = Nat::from(rng.gen_range(min_amount_0..max_amount_0));
    let receive_token = kong_backend
        .token(symbol_1)
        .ok_or(anyhow::anyhow!("Token {} not found", symbol_1))?;
    // call swap_amounts to get the correct amounts
    let swap_amounts = kong_backend
        .swap_amounts(pay_token.symbol(), &pay_amount, receive_token.symbol())
        .await?;
    // use the results from swap_amounts
    let pay_amount = swap_amounts.pay_amount;
    let receive_amount = Some(swap_amounts.receive_amount);

    let swap_args = SwapArgs {
        pay_token: pay_token.symbol().to_string(),
        pay_amount,
        pay_tx_id: None,
        receive_token: receive_token.symbol().to_string(),
        receive_amount,
        receive_address: None,
        max_slippage: None,
        referred_by: None,
    };
    // swap using icrc1_transfer() method
    // let swap = kong_backend.swap_transfer(&swap_args).await?;
    // swap using icrc2_approve() and then icrc2_transfer_from() method
    let swap_reply = kong_backend.swap(&swap_args).await?;

    println!(
        "Swap (sync) #{} {} {} to {} {}",
        swap_reply.request_id,
        nat_divide_as_f64(&swap_reply.pay_amount, &nat_10pow(pay_token.decimals().into())).unwrap(),
        pay_token.symbol(),
        nat_divide_as_f64(&swap_reply.receive_amount, &nat_10pow(receive_token.decimals().into())).unwrap(),
        receive_token.symbol()
    );

    Ok(swap_reply)
}

pub async fn swap_async(
    rng: &mut ThreadRng,
    kong_backend: &KongBackend,
    symbol_0: &str,
    symbol_1: &str,
    min_amount: u64,
    max_amount: u64,
) -> Result<SwapReply> {
    let pay_token = kong_backend
        .token(symbol_0)
        .ok_or(anyhow::anyhow!("Token {} not found", symbol_0))?;
    let pay_amount = Nat::from(rng.gen_range(min_amount..max_amount));
    let receive_token = kong_backend
        .token(symbol_1)
        .ok_or(anyhow::anyhow!("Token {} not found", symbol_1))?;
    // call swap_amounts to get the correct amounts
    let swap_amounts = kong_backend
        .swap_amounts(pay_token.symbol(), &pay_amount, receive_token.symbol())
        .await?;
    // use the results from swap_amounts
    let pay_amount = swap_amounts.pay_amount;
    let receive_amount = Some(swap_amounts.receive_amount);

    let swap_args = SwapArgs {
        pay_token: pay_token.symbol().to_string(),
        pay_amount,
        pay_tx_id: None,
        receive_token: receive_token.symbol().to_string(),
        receive_amount,
        receive_address: None,
        max_slippage: None,
        referred_by: None,
    };
    // swap using icrc1_transfer() method
    // let swap = kong_backend.swap_transfer_async(&swap_args, tokens).await?;
    // swap using icrc2_approve() and then icrc2_transfer_from() method
    let request_id = kong_backend.swap_async(&swap_args).await?;

    print!(
        "Swap (async) #{} {} {} to {} {}",
        request_id,
        nat_divide_as_f64(&swap_args.pay_amount, &nat_10pow(pay_token.decimals().into())).unwrap(),
        pay_token.symbol(),
        nat_divide_as_f64(
            &swap_args.receive_amount.unwrap(),
            &nat_10pow(receive_token.decimals().into())
        )
        .unwrap(),
        receive_token.symbol()
    );

    // poll requests(request_id) to get the swap status
    let duration = Duration::from_secs(60);
    let result = timeout(duration, async {
        loop {
            match kong_backend.requests(Some(request_id)).await {
                Ok(requests) => {
                    if requests.is_empty() {
                        print!(".");
                        continue;
                    }
                    let request = &requests[0];
                    match request.statuses.last() {
                        Some(status) => {
                            if status == "Success" || status == "Failed" {
                                return Ok(request.clone());
                            } else {
                                print!(".");
                            }
                        }
                        None => {
                            print!(".");
                        }
                    }
                }
                Err(e) => {
                    return Err(anyhow::anyhow!("Request error: {:?}", e));
                }
            }
            tokio::time::sleep(Duration::from_millis(500)).await;
        }
    })
    .await;

    match result {
        Ok(Ok(request)) => match request.reply {
            Reply::Swap(reply) => Ok(reply),
            _ => Err(anyhow::anyhow!("Request reply not of SwapReply type")),
        },
        Ok(Err(err)) => Err(anyhow::anyhow!("Request error: {:?}", err)),
        Err(e) => Err(anyhow::anyhow!("Timeout error: {:?}", e)),
    }
}
