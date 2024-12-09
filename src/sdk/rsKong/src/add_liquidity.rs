use anyhow::Result;
use candid::Nat;
use rand::rngs::ThreadRng;
use rand::Rng;

use crate::kong_backend::add_liquidity::add_liquidity_args::AddLiquidityArgs;
use crate::kong_backend::add_liquidity::add_liquidity_reply::AddLiquidityReply;
use crate::kong_backend::helpers::nat_helpers::{nat_10pow, nat_divide_as_f64};
use crate::kong_backend::tokens::token::Token;
use crate::kong_backend::KongBackend;

pub async fn add_liquidity(
    rng: &mut ThreadRng,
    kong_backend: &KongBackend,
    symbol_0: &str,
    (min_amount_0, max_amount_0): (u64, u64),
    symbol_1: &str,
) -> Result<AddLiquidityReply> {
    let token_0 = kong_backend
        .token(symbol_0)
        .ok_or(anyhow::anyhow!("Token {} not found", symbol_0))?;
    let token_amount_0 = Nat::from(rng.gen_range(min_amount_0..max_amount_0));
    let token_1 = kong_backend
        .token(symbol_1)
        .ok_or(anyhow::anyhow!("Token {} not found", symbol_1))?;
    // call add_liquidity_amounts to get the correct amounts
    let add_liquidity_amounts = kong_backend
        .add_liquidity_amounts(token_0.symbol(), &token_amount_0, token_1.symbol())
        .await?;
    // use the results from add_liquidity_amounts
    let amount_0 = add_liquidity_amounts.amount_0;
    let amount_1 = add_liquidity_amounts.amount_1;

    let add_liquidity_args = AddLiquidityArgs {
        token_0: token_0.symbol().to_string(),
        amount_0,
        tx_id_0: None,
        token_1: token_1.symbol().to_string(),
        amount_1,
        tx_id_1: None,
    };
    let add_liquidity = kong_backend.add_liquidity(&add_liquidity_args).await?;

    println!(
        "Add Liquidity (sync) #{} {} {} and {} {} for {} LP tokens",
        add_liquidity.request_id,
        nat_divide_as_f64(&add_liquidity.amount_0, &nat_10pow(token_0.decimals().into())).unwrap(),
        token_0.symbol(),
        nat_divide_as_f64(&add_liquidity.amount_1, &nat_10pow(token_1.decimals().into())).unwrap(),
        token_1.symbol(),
        add_liquidity.add_lp_token_amount,
    );

    Ok(add_liquidity)
}
