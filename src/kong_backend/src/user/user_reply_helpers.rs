use candid::Principal;

use super::user_reply::UserReply;

use crate::ic::id::principal_to_account_id;
use crate::stable_user::stable_user::StableUser;
use crate::stable_user::user_map;

pub fn to_user_reply(user: &StableUser) -> UserReply {
    let principal = Principal::from_text(&user.principal_id).unwrap();
    let account_id = principal_to_account_id(principal);
    // if referred by user exists, get the referred user's referral code
    let referred_by = user
        .referred_by
        .and_then(|referred_user| user_map::get_by_user_id(referred_user).map(|referred_user| referred_user.my_referral_code));
    UserReply {
        user_id: user.user_id,
        principal_id: user.principal_id.clone(),
        account_id: account_id.to_string(),
        my_referral_code: user.my_referral_code.clone(),
        referred_by,
        referred_by_expires_at: user.referred_by_expires_at,
        fee_level: user.fee_level,
        fee_level_expires_at: user.fee_level_expires_at,
    }
}
