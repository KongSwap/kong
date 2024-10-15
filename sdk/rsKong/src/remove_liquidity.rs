use anyhow::Result;
use candid::Nat;

use crate::kong_backend::helpers::nat_helpers::{nat_10pow, nat_divide_as_f64};
use crate::kong_backend::remove_liquidity::remove_liquidity_args::RemoveLiquidityArgs;
use crate::kong_backend::remove_liquidity::remove_liquidity_reply::RemoveLiquidityReply;
use crate::kong_backend::tokens::token::Token;
use crate::kong_backend::KongBackend;

pub async fn remove_liquidity(
    kong_backend: &KongBackend,
    symbol_0: &str,
    symbol_1: &str,
    remove_lp_token_amount: &Nat,
) -> Result<RemoveLiquidityReply> {
    let token_0 = kong_backend
        .token(symbol_0)
        .ok_or(anyhow::anyhow!("Token {} not found", symbol_0))?;
    let token_1 = kong_backend
        .token(symbol_1)
        .ok_or(anyhow::anyhow!("Token {} not found", symbol_1))?;

    let remove_liquidity_args = RemoveLiquidityArgs {
        token_0: token_0.symbol().to_string(),
        token_1: token_1.symbol().to_string(),
        remove_lp_token_amount: remove_lp_token_amount.clone(),
    };
    let remove_liquidity = kong_backend.remove_liquidity(&remove_liquidity_args).await?;

    println!(
        "Remove Liquidity (sync) #{} {} LP tokens for {} {} and {} {}",
        remove_liquidity.request_id,
        remove_liquidity.remove_lp_token_amount,
        nat_divide_as_f64(&remove_liquidity.amount_0, &nat_10pow(token_0.decimals().into())).unwrap(),
        token_0.symbol(),
        nat_divide_as_f64(&remove_liquidity.amount_1, &nat_10pow(token_1.decimals().into())).unwrap(),
        token_1.symbol(),
    );

    Ok(remove_liquidity)
}
