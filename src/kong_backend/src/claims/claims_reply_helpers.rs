use super::claims_reply::ClaimsReply;

use crate::helpers::nat_helpers::nat_zero;
use crate::stable_claim::stable_claim::StableClaim;
use crate::stable_token::token::Token;
use crate::stable_token::token_map;

pub fn to_claims_reply(claim: &StableClaim) -> ClaimsReply {
    let (chain, symbol, fee) = match token_map::get_by_token_id(claim.token_id) {
        Some(token) => (token.chain().to_string(), token.symbol().to_string(), token.fee()),
        None => ("Chain not found".to_string(), "Symbol not found".to_string(), nat_zero()),
    };
    let to_address = match claim.to_address.as_ref() {
        Some(address) => address.to_string(),
        None => "To address not found".to_string(),
    };
    ClaimsReply {
        claim_id: claim.claim_id,
        status: claim.status.to_string(),
        chain,
        symbol,
        amount: claim.amount.clone(),
        fee,
        to_address,
        ts: claim.ts,
    }
}
