use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Clone, Debug, Serialize, Deserialize)]
pub struct UserReply {
    pub user_id: u32,
    pub principal_id: String,
    pub account_id: String,
    pub user_name: String,
    pub my_referral_code: String,
    pub referred_by: Option<String>,
    pub referred_by_expires_at: Option<u64>,
    pub fee_level: u8,
    pub fee_level_expires_at: Option<u64>,
    pub campaign1_flags: Vec<bool>,
}
