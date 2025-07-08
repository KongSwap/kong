use ic_cdk::update;

use super::update_token_is_removed_args::UpdateTokenIsRemovedArgs;
use super::update_token_reply::UpdateTokenReply;
use super::update_token_reply_helpers::to_update_token_reply;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_token::ic_token::ICToken;
use crate::stable_token::lp_token::LPToken;
use crate::stable_token::stable_token::StableToken;
use crate::stable_token::token::Token;
use crate::stable_token::token_map;

/// Updates the is_removed field of a token
#[update(guard = "caller_is_kingkong")]
async fn update_token_is_removed(args: UpdateTokenIsRemovedArgs) -> Result<UpdateTokenReply, String> {
    let stable_token = token_map::get_by_token(&args.token)?;
    
    let updated_token = match stable_token {
        StableToken::IC(token) => StableToken::IC(ICToken {
            is_removed: args.is_removed,
            ..token
        }),
        StableToken::LP(token) => StableToken::LP(LPToken {
            is_removed: args.is_removed,
            ..token
        }),
    };
    
    token_map::update(&updated_token);
    
    let final_token = token_map::get_by_token_id(updated_token.token_id())
        .ok_or_else(|| format!("Failed to update is_removed for token {}", args.token))?;
    
    Ok(to_update_token_reply(&final_token)?)
}