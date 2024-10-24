use ic_cdk::{query, update};
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::USER_MAP;
use crate::stable_user::stable_user::{StableUser, StableUserId};

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_users(user_id: Option<u32>) -> Result<String, String> {
    match user_id {
        Some(user_id) => USER_MAP.with(|m| {
            m.borrow().iter().find(|(k, _)| k.0 == user_id).map_or_else(
                || Err(format!("User #{} not found", user_id)),
                |(k, v)| serde_json::to_string(&(k, v)).map_err(|e| format!("Failed to serialize: {}", e)),
            )
        }),
        None => {
            let users: BTreeMap<_, _> = USER_MAP.with(|m| m.borrow().iter().collect());
            serde_json::to_string(&users).map_err(|e| format!("Failed to serialize: {}", e))
        }
    }
}

#[update(hidden = true, guard = "caller_is_kingkong")]
fn edit_user(user_profile: String) -> Result<String, String> {
    let user: StableUser = match serde_json::from_str(&user_profile) {
        Ok(user_profile) => user_profile,
        Err(e) => return Err(format!("Invalid user: {}", e)),
    };
    USER_MAP.with(|m| m.borrow_mut().insert(StableUserId(user.user_id), user));

    Ok("User updated".to_string())
}

#[update(hidden = true, guard = "caller_is_kingkong")]
fn remove_user(user_id: u32) -> Result<String, String> {
    match USER_MAP.with(|m| m.borrow_mut().remove(&StableUserId(user_id))) {
        Some(_) => Ok(format!("User {} removed", user_id)),
        None => Err("User not found".to_string()),
    }
}
