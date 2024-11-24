use super::stable_claim::StableClaim;

use crate::stable_token::stable_token::StableToken;
use crate::stable_token::token_map;

pub fn get_token(claim: &StableClaim) -> StableToken {
    token_map::get_by_token_id(claim.token_id).unwrap()
}
