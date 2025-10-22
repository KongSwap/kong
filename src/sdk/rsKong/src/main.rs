use anyhow::Result;
use std::env;
use std::thread;
use tokio::runtime::Runtime;
use tokio::time::Duration;

use add_liquidity::add_liquidity;
use agent::{create_agent, create_random_identity};
use remove_liquidity::remove_liquidity;
use swap::{swap, swap_async};

use crate::kong_backend::KongBackend;
use crate::kong_faucet::KongFaucet;

mod add_liquidity;
mod agent;
mod kong_backend;
mod kong_faucet;
mod remove_liquidity;
mod swap;

const LOCAL_REPLICA: &str = "http://localhost:8000";
const MAINNET_REPLICA: &str = "https://ic0.app";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = env::args().collect::<Vec<String>>();

    // let (replica_url, is_mainnet) = if args.contains(&"--ic".to_string()) {
    //     (MAINNET_REPLICA, true)
    // } else {
    //     (LOCAL_REPLICA, false)
    // };

    // create a new random identity
    // let identity = create_random_identity();
    // let agent = create_agent(replica_url, identity, is_mainnet).await?;
    // create agents for Kong backend and faucet canister
    // let kong_backend = KongBackend::new(&agent);

    // example calls to Kong backend
    // let icrc1_name = kong_backend.icrc1_name().await?;
    // println!("icrc1_name: {}", icrc1_name);

    // get list of pools
    // let pools = kong_backend.pools(None).await?;
    // println!("pools: {:?}", pools);

    // run the ICP_ckUSDT swap bot in it's own thread
    let tokens_args = args.clone();
    let rt = Runtime::new().unwrap();
    let icp_ckusdt_swap = thread::spawn(move || {
        rt.block_on(async {
            _ = run_icp_ckusdt_swaps(&tokens_args).await;
        });
    });

    // run the ckUSDC_ckUSDT swap bot in it's own thread
    let tokens_args = args.clone();
    let rt = Runtime::new().unwrap();
    let ckusdc_ckusdt_swap = thread::spawn(move || {
        rt.block_on(async {
            _ = run_ckusdc_ckusdt_swaps(&tokens_args).await;
        });
    });

    //run the ckBTC_ckUSDT swap bot in it's own thread
    let tokens_args = args.clone();
    let rt = Runtime::new().unwrap();
    let ckbtc_ckusdt_swap = thread::spawn(move || {
        rt.block_on(async {
            _ = run_ckbtc_ckusdt_swaps(&tokens_args).await;
        });
    });

    //run the ckETH_ckUSDT swap bot in it's own thread
    let tokens_args = args.clone();
    let rt = Runtime::new().unwrap();
    let cketh_ckusdt_swap = thread::spawn(move || {
        rt.block_on(async {
            _ = run_cketh_ckusdt_swaps(&tokens_args).await;
        });
    });

    // run the ICP_ckUSDT liquidity pool bot in it's own thread
    let tokens_args = args.clone();
    let rt = Runtime::new().unwrap();
    let icp_ckusdt_liquidity_pool = thread::spawn(move || {
        rt.block_on(async {
            _ = run_icp_ckusdt_liquidity_pool(&tokens_args).await;
        });
    });

    icp_ckusdt_swap.join().unwrap();
    ckusdc_ckusdt_swap.join().unwrap();
    ckbtc_ckusdt_swap.join().unwrap();
    cketh_ckusdt_swap.join().unwrap();
    icp_ckusdt_liquidity_pool.join().unwrap();

    Ok(())
}

async fn run_icp_ckusdt_swaps(args: &[String]) -> Result<()> {
    // need to create separate accounts for each bot
    let (replica_url, is_mainnet, is_prod) = if args.contains(&"--prod".to_string()) {
        (MAINNET_REPLICA, true, true)
    } else if args.contains(&"--staging".to_string()) {
        (MAINNET_REPLICA, true, false)
    } else {
        (LOCAL_REPLICA, false, false)
    };
    // create a new random identity
    let identity = create_random_identity();
    let agent = create_agent(replica_url, identity, is_mainnet).await?;
    // create agents for Kong backend and faucet canister
    let kong_backend = KongBackend::new(&agent, is_prod).await;
    let kong_faucet = KongFaucet::new(&agent);

    // claim some test tokens from the faucet
    let faucet_claim = kong_faucet.claim().await?;
    println!("Faucet claimed: {:?}", faucet_claim);

    let mut rng = rand::thread_rng();

    loop {
        // swap ICP to ckUSDT with random amount
        match swap(
            &mut rng,
            &kong_backend,
            "ICP",
            (10_000_000_u64, 20_000_000_u64), // 0.10 ICP to 0.20 ICP
            "ckUSDT",
        )
        .await
        {
            Ok(_) => {}
            Err(e) => {
                println!("Swap error: {:?}", e);
            }
        }
        tokio::time::sleep(Duration::from_secs(5)).await;
        // swap ckUSDT to ICP with random amount
        match swap_async(
            &mut rng,
            &kong_backend,
            "ckUSDT",
            "ICP",
            500_000_u64,   // 0.5 ckUSDT
            2_000_000_u64, // 2 ckUSDT
        )
        .await
        {
            Ok(_) => {}
            Err(e) => {
                println!("Swap error: {:?}", e);
            }
        }
        tokio::time::sleep(Duration::from_secs(5)).await;
    }
}

async fn run_ckusdc_ckusdt_swaps(args: &[String]) -> Result<()> {
    // need to create separate accounts for each bot
    let (replica_url, is_mainnet, is_prod) = if args.contains(&"--prod".to_string()) {
        (MAINNET_REPLICA, true, true)
    } else if args.contains(&"--staging".to_string()) {
        (MAINNET_REPLICA, true, false)
    } else {
        (LOCAL_REPLICA, false, false)
    };
    // create a new random identity
    let identity = create_random_identity();
    let agent = create_agent(replica_url, identity, is_mainnet).await?;
    // create agents for Kong backend and faucet canister
    let kong_backend = KongBackend::new(&agent, is_prod).await;
    let kong_faucet = KongFaucet::new(&agent);

    // claim some test tokens from the faucet
    let faucet_claim = kong_faucet.claim().await?;
    println!("Faucet claimed: {:?}", faucet_claim);

    let mut rng = rand::thread_rng();

    loop {
        // swap ckUSDC to ckUSDT with random amount
        match swap(
            &mut rng,
            &kong_backend,
            "ckUSDC",
            (500_000_u64, 2_000_000_u64), // 0.5 ckUSDC to 2 ckUSDC
            "ckUSDT",
        )
        .await
        {
            Ok(_) => {}
            Err(e) => {
                println!("Swap error: {:?}", e);
            }
        }
        tokio::time::sleep(Duration::from_secs(5)).await;
        // swap ckUSDT to ckUSDC with random amount
        match swap_async(
            &mut rng,
            &kong_backend,
            "ckUSDT",
            "ckUSDC",
            500_000_u64,   // 0.5 ckUSDT
            2_000_000_u64, // 2 ckUSDT
        )
        .await
        {
            Ok(_) => {}
            Err(e) => {
                println!("Swap error: {:?}", e);
            }
        }
        tokio::time::sleep(Duration::from_secs(5)).await;
    }
}

async fn run_ckbtc_ckusdt_swaps(args: &[String]) -> Result<()> {
    // need to create separate accounts for each bot
    let (replica_url, is_mainnet, is_prod) = if args.contains(&"--prod".to_string()) {
        (MAINNET_REPLICA, true, true)
    } else if args.contains(&"--staging".to_string()) {
        (MAINNET_REPLICA, true, false)
    } else {
        (LOCAL_REPLICA, false, false)
    };
    // create a new random identity
    let identity = create_random_identity();
    let agent = create_agent(replica_url, identity, is_mainnet).await?;
    // create agents for Kong backend and faucet canister
    let kong_backend = KongBackend::new(&agent, is_prod).await;
    let kong_faucet = KongFaucet::new(&agent);

    // claim some test tokens from the faucet
    let faucet_claim = kong_faucet.claim().await?;
    println!("Faucet claimed: {:?}", faucet_claim);

    let mut rng = rand::thread_rng();

    loop {
        match swap(
            &mut rng,
            &kong_backend,
            "ckBTC",
            (1_500_u64, 5_000_u64), // 0.000015 ckBTC to 0.00005 ckBTC
            "ckUSDT",
        )
        .await
        {
            Ok(_) => {}
            Err(e) => {
                println!("Swap error: {:?}", e);
            }
        }
        tokio::time::sleep(Duration::from_secs(5)).await;
        match swap_async(
            &mut rng,
            &kong_backend,
            "ckUSDT",
            "ckBTC",
            500_000_u64,   // 0.5 ckUSDT
            2_000_000_u64, // 2 ckUSDT
        )
        .await
        {
            Ok(_) => {}
            Err(e) => {
                println!("Swap error: {:?}", e);
            }
        }
        tokio::time::sleep(Duration::from_secs(5)).await;
    }
}

async fn run_cketh_ckusdt_swaps(args: &[String]) -> Result<()> {
    // need to create separate accounts for each bot
    let (replica_url, is_mainnet, is_prod) = if args.contains(&"--prod".to_string()) {
        (MAINNET_REPLICA, true, true)
    } else if args.contains(&"--staging".to_string()) {
        (MAINNET_REPLICA, true, false)
    } else {
        (LOCAL_REPLICA, false, false)
    };
    // create a new random identity
    let identity = create_random_identity();
    let agent = create_agent(replica_url, identity, is_mainnet).await?;
    // create agents for Kong backend and faucet canister
    let kong_backend = KongBackend::new(&agent, is_prod).await;
    let kong_faucet = KongFaucet::new(&agent);

    // claim some test tokens from the faucet
    let faucet_claim = kong_faucet.claim().await?;
    println!("Faucet claimed: {:?}", faucet_claim);

    let mut rng = rand::thread_rng();

    loop {
        match swap(
            &mut rng,
            &kong_backend,
            "ckETH",
            (200_000_000_000_000_u64, 1_000_000_000_000_000_u64), // 0.0002 ckETH to 0.001 ckETH
            "ckUSDT",
        )
        .await
        {
            Ok(_) => {}
            Err(e) => {
                println!("Swap error: {:?}", e);
            }
        }
        tokio::time::sleep(Duration::from_secs(5)).await;
        match swap_async(
            &mut rng,
            &kong_backend,
            "ckUSDT",
            "ckETH",
            500_000_u64,   // 0.5 ckUSDT
            2_000_000_u64, // 2 ckUSDT
        )
        .await
        {
            Ok(_) => {}
            Err(e) => {
                println!("Swap error: {:?}", e);
            }
        }
        tokio::time::sleep(Duration::from_secs(5)).await;
    }
}

async fn run_icp_ckusdt_liquidity_pool(args: &[String]) -> Result<()> {
    // need to create separate accounts for each bot
    let (replica_url, is_mainnet, is_prod) = if args.contains(&"--prod".to_string()) {
        (MAINNET_REPLICA, true, true)
    } else if args.contains(&"--staging".to_string()) {
        (MAINNET_REPLICA, true, false)
    } else {
        (LOCAL_REPLICA, false, false)
    };
    // create a new random identity
    let identity = create_random_identity();
    let agent = create_agent(replica_url, identity, is_mainnet).await?;
    // create agents for Kong backend and faucet canister
    let kong_backend = KongBackend::new(&agent, is_prod).await;
    let kong_faucet = KongFaucet::new(&agent);

    // claim some test tokens from the faucet
    let faucet_claim = kong_faucet.claim().await?;
    println!("Faucet claimed: {:?}", faucet_claim);

    let mut rng = rand::thread_rng();

    loop {
        match add_liquidity(
            &mut rng,
            &kong_backend,
            "ICP",
            (50_000_000_u64, 200_000_000_u64), // 0.5 ICP to 2 ICP
            "ckUSDT",
        )
        .await
        {
            Ok(add_liquidity) => {
                tokio::time::sleep(Duration::from_secs(5)).await;
                match remove_liquidity(&kong_backend, "ICP", "ckUSDT", &add_liquidity.add_lp_token_amount).await {
                    Ok(_) => {}
                    Err(e) => {
                        println!("Remove Liquidity error: {:?}", e);
                    }
                }
            }
            Err(e) => {
                println!("Add Liquidity error: {:?}", e);
            }
        };
    }
}
