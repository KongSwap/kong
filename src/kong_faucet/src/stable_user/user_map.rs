use kong_lib::ic::get_time::get_time;
use kong_lib::ic::id::caller_principal_id;

use super::stable_user::{StableUser, StableUserId};

use crate::ic::id::is_caller_anonymous;
use crate::stable_memory::USER_MAP;

fn get() -> Option<StableUser> {
    if is_caller_anonymous() {
        return None;
    }

    USER_MAP.with(|m| m.borrow().get(&StableUserId(caller_principal_id())))
}

// this will get a user or return a default user if the user is not found
pub async fn get_user() -> Result<StableUser, String> {
    if is_caller_anonymous() {
        Err("Anonymous user")?
    }

    Ok(match get() {
        Some(user) => user,
        None => {
            let user = StableUser::default();
            USER_MAP.with(|m| {
                let mut map = m.borrow_mut();
                map.insert(StableUserId(caller_principal_id()), user.clone());
            });
            user
        }
    })
}

// update the user's last_claimed_at with now
pub fn update_user_token_claim() -> Result<u64, String> {
    match get() {
        Some(mut user) => {
            user.last_claimed_at = get_time();
            USER_MAP.with(|m| {
                m.borrow_mut().insert(StableUserId(caller_principal_id()), user.clone());
            });
            Ok(user.last_claimed_at)
        }
        None => Err("User not found".to_string()),
    }
}
