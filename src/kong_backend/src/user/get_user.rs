use ic_cdk::query;

use super::user_reply::{to_user_reply, UserReply};

use crate::canister::guards::not_in_maintenance_mode;
use crate::stable_user::user_map;

#[query(guard = "not_in_maintenance_mode")]
pub fn get_user() -> Result<UserReply, String> {
    let user = user_map::get_by_caller().ok().flatten().unwrap_or_default();
    Ok(to_user_reply(&user))
}
