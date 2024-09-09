use crate::agent::{create_agent, create_random_identity};
use crate::kong_backend::helpers::nat_helpers::{nat_10pow, nat_divide_as_f64};
use crate::kong_backend::swap::swap_args::SwapArgs;
use crate::kong_backend::tokens::decimals::Decimals;
use crate::kong_backend::tokens::symbol::Symbol;
use crate::kong_backend::tokens::tokens_reply::TokensReply;
use crate::kong_backend::KongBackend;
use anyhow::Result;
use candid::Nat;
use kong_faucet::KongFaucet;
use rand::rngs::ThreadRng;
use rand::Rng;
use std::env;
use std::thread;
use tokio::runtime::Runtime;
use tokio::time::{timeout, Duration};

mod agent;
mod kong_backend;
mod kong_faucet;

const LOCAL_REPLICA: &str = "http://localhost:4943";
const MAINNET_REPLICA: &str = "https://ic0.app";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = env::args().collect::<Vec<String>>();
    let (replica_url, is_mainnet) = if args.contains(&"--ic".to_string()) {
        (MAINNET_REPLICA, true)
    } else {
        (LOCAL_REPLICA, false)
    };

    // create a new random identity
    let identity = create_random_identity();
    let agent = create_agent(replica_url, identity, is_mainnet).await?;
    // create agents for Kong backend and faucet canister
    let kong_backend = KongBackend::new(&agent);
    let kong_faucet = KongFaucet::new(&agent);

    // example calls to Kong backend
    // let icrc1_name = kong_backend.icrc1_name().await?;
    // println!("icrc1_name: {}", icrc1_name);

    // let version = kong_backend.version().await?;
    // println!("version: {}", version);

    // let whoami = kong_backend.whoami().await?;
    // println!("whoami: {}", whoami);

    // claim some test tokens from the faucet
    let faucet_claim = kong_faucet.claim().await?;
    println!("Faucet claimed: {:?}", faucet_claim);

    // get list of tokens
    let tokens = kong_backend.tokens(None).await?;
    println!("tokens: {:?}", tokens);

    // get list of pools
    // let pools = kong_backend.pools(None).await?;
    // println!("pools: {:?}", pools);

    // run the ICP_ckUSDT swap bot in it's own thread
    let tokens_clone = tokens.clone();
    let kong_backend_clone = kong_backend.clone();
    let rt = Runtime::new().unwrap();
    let icp_ckusdc = thread::spawn(move || {
        rt.block_on(async {
            _ = run_icp_ckusdc(&tokens_clone, &kong_backend_clone).await;
        });
    });

    //run the ckBTC_ckUSDT swap bot in it's own thread
    // let tokens_clone = tokens.clone();
    // let kong_backend_clone = kong_backend.clone();
    // let rt = Runtime::new().unwrap();
    // let ckbtc_ckusdc = thread::spawn(move || {
    //     rt.block_on(async {
    //         _ = run_ckbtc_ckusdc(&tokens_clone, &kong_backend_clone).await;
    //     });
    // });

    icp_ckusdc.join().unwrap();
    //ckbtc_ckusdc.join().unwrap();

    Ok(())
}

async fn run_icp_ckusdc(tokens: &[TokensReply], kong_backend: &KongBackend) -> Result<()> {
    let mut rng = rand::thread_rng();
    loop {
        // swap ICP to ckUSDT with random amount
        match swap(
            tokens,
            &mut rng,
            kong_backend,
            "ICP",
            "ckUSDT",
            25_000_000_u32,     // 0.25 ICP
            100_000_000_u32,    // 1.0 ICP
        )
        .await
        {
            Ok(_) => {}
            Err(e) => {
                println!("Swap error: {}", e.to_string());
            }
        }
        // wait 1 second
        tokio::time::sleep(Duration::from_secs(1)).await;
        // swap ckUSDT to ICP with random amount
        match swap_async(
            tokens,
            &mut rng,
            kong_backend,
            "ckUSDT",
            "ICP",
            2_000_000_u32, // 2 ckUSDT
            8_000_000_u32, // 8 ckUSDT
        )
        .await
        {
            Ok(_) => {}
            Err(e) => {
                println!("Swap error: {}", e.to_string());
            }
        }
        tokio::time::sleep(Duration::from_secs(1)).await;
    }

    Ok(())
}

/*
async fn run_ckbtc_ckusdc(tokens: &[TokensReply], kong_backend: &KongBackend) -> Result<()> {
    let mut rng = rand::thread_rng();
    loop {
        match swap(
            tokens,
            &mut rng,
            kong_backend,
            "ckBTC",
            "ckUSDT",
            10_000_u32, // 0.0001 ckBTC
            20_000_u32,
        )
        .await
        {
            Ok(_) => {}
            Err(e) => {
                println!("Swap error: {}", e.to_string());
            }
        }
        tokio::time::sleep(Duration::from_secs(1)).await;
        match swap(
            tokens,
            &mut rng,
            kong_backend,
            "ckUSDT",
            "ckBTC",
            2_000_000_u32, // 2 ckUSDT
            5_000_000_u32, // 5 ckUSDT
        )
        .await
        {
            Ok(_) => {}
            Err(e) => {
                println!("Swap error: {}", e.to_string());
            }
        }
        tokio::time::sleep(Duration::from_secs(1)).await;
    }

    Ok(())
}
*/

async fn swap(
    tokens: &[TokensReply],
    rng: &mut ThreadRng,
    kong_backend: &KongBackend,
    symbol0: &str,
    symbol1: &str,
    min_amount: u32,
    max_amount: u32,
) -> Result<()> {
    let pay_token = tokens.iter().find(|token| token.symbol() == symbol0).unwrap();
    let pay_amount = Nat::from(rng.gen_range(min_amount..max_amount));
    let receive_token = tokens.iter().find(|token| token.symbol() == symbol1).unwrap();
    // call swap_amounts to get the correct amounts
    let swap_amounts = kong_backend
        .swap_amounts(&pay_token.symbol(), &pay_amount, &receive_token.symbol())
        .await?;
    // use the receive amount from swap_amounts
    let pay_amount = swap_amounts.pay_amount;
    let receive_amount = Some(swap_amounts.receive_amount);

    let swap_args = SwapArgs {
        pay_token: pay_token.symbol(),
        pay_amount,
        pay_block_id: None,
        receive_token: receive_token.symbol(),
        receive_amount,
        receive_address: None,
        max_slippage: None,
        referred_by: None,
    };
    // swap using icrc1_transfer() method
    // let swap = kong_backend.swap_transfer(&swap_args, tokens).await?;
    // swap using icrc2_approve() and then icrc2_transfer_from() method
    let swap = kong_backend.swap(&swap_args, tokens).await?;

    println!(
        "Swap (sync) #{} {} {} to {} {}",
        swap.request_id,
        nat_divide_as_f64(&swap.pay_amount, &nat_10pow(pay_token.decimals().into())).unwrap(),
        pay_token.symbol(),
        nat_divide_as_f64(&swap.receive_amount, &nat_10pow(receive_token.decimals().into())).unwrap(),
        receive_token.symbol()
    );

    Ok(())
}

async fn swap_async(
    tokens: &[TokensReply],
    rng: &mut ThreadRng,
    kong_backend: &KongBackend,
    symbol0: &str,
    symbol1: &str,
    min_amount: u32,
    max_amount: u32,
) -> Result<()> {
    let pay_token = tokens.iter().find(|token| token.symbol() == symbol0).unwrap();
    let pay_amount = Nat::from(rng.gen_range(min_amount..max_amount));
    let receive_token = tokens.iter().find(|token| token.symbol() == symbol1).unwrap();
    // call swap_amounts to get the correct amounts
    let swap_amounts = kong_backend
        .swap_amounts(&pay_token.symbol(), &pay_amount, &receive_token.symbol())
        .await?;
    // use the receive amount from swap_amounts
    let pay_amount = swap_amounts.pay_amount;
    let receive_amount = Some(swap_amounts.receive_amount);

    let swap_args = SwapArgs {
        pay_token: pay_token.symbol(),
        pay_amount,
        pay_block_id: None,
        receive_token: receive_token.symbol(),
        receive_amount,
        receive_address: None,
        max_slippage: None,
        referred_by: None,
    };
    // swap using icrc1_transfer() method
    // let swap = kong_backend.swap_transfer_async(&swap_args, tokens).await?;
    // swap using icrc2_approve() and then icrc2_transfer_from() method
    let request_id = kong_backend.swap_async(&swap_args, tokens).await?;

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
    let duration = Duration::from_secs(30);
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
                                println!("{}", status);
                                break;
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
                    println!("Request error: {}", e.to_string());
                }
            }
            tokio::time::sleep(Duration::from_millis(500)).await;
        }
    })
    .await;

    match result {
        Ok(_) => Ok(()),
        Err(e) => Err(anyhow::anyhow!("Timeout error: {}", e.to_string())),
    }
}
