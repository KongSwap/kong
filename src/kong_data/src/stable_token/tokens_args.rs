use candid::CandidType;
use serde::Deserialize;



#[derive(CandidType, Deserialize, Debug)]
pub struct TokensArgs {
    pub enabled_only: bool,
    pub wildcard: Option<String>,
    pub n_skip: Option<u32>,
    pub n_take: Option<u32>,
}