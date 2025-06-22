use candid::Principal;
use ic_cdk::update;

use super::update_token_args::UpdateTokenArgs;
use super::update_token_reply::UpdateTokenReply;
use super::update_token_reply_helpers::to_update_token_reply;

use crate::chains::chains::IC_CHAIN;
use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_token::ic_token::ICToken;
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::token;
use crate::stable_token::token::Token;
use crate::stable_token::token_map;

/// updates the token
/// also updates
#[update(guard = "not_in_maintenance_mode")]
async fn update_token(args: UpdateTokenArgs) -> Result<UpdateTokenReply, String> {
    // Only IC tokens of format IC.CanisterId supported
    match token_map::get_chain(&args.token) {
        Some(chain) if chain == IC_CHAIN => to_update_token_reply(&update_ic_token(&args.token).await?),
        Some(_) | None => Err("Chain not supported")?,
    }
}

pub async fn update_ic_token(token: &str) -> Result<StableToken, String> {
    let stable_token = token_map::get_by_token(token)?;
    let address = stable_token.address();
    let token_id = stable_token.token_id();
    let symbol = stable_token.symbol();

    let canister_id = Principal::from_text(address).map_err(|e| format!("Invalid canister id {}: {}", token, e))?;

    let mut ic_token = ICToken::new(&canister_id).await?;
    ic_token.token_id = token_id;

    token_map::update(&StableToken::IC(ic_token.clone()));

    // update _ckUSDT pool for symbol
    let ckusdt = token_map::get_ckusdt()?;
    if let Ok(StableToken::LP(mut lp_token)) = token_map::get_by_token(&format!("LP.{}_{}", symbol, ckusdt.symbol())) {
        lp_token.symbol = token::symbol(&StableToken::IC(ic_token.clone()), &ckusdt);
        token_map::update(&StableToken::LP(lp_token));
    }

    // update _ICP pool for symbol
    let icp = token_map::get_icp()?;
    if let Ok(StableToken::LP(mut lp_token)) = token_map::get_by_token(&format!("LP.{}_{}", symbol, icp.symbol())) {
        lp_token.symbol = token::symbol(&StableToken::IC(ic_token), &icp);
        token_map::update(&StableToken::LP(lp_token));
    }

    token_map::get_by_token_id(token_id).ok_or_else(|| format!("Failed to update token {}", token))
}
