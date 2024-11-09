use ic_cdk::{query, update};
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::USER_MAP;
use crate::stable_user::stable_user::{StableUser, StableUserId};

const MAX_USERS: usize = 2_000;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_users(user_id: Option<u32>, num_users: Option<u16>) -> Result<String, String> {
    USER_MAP.with(|m| {
        let map = m.borrow();
        let users: BTreeMap<_, _> = match user_id {
            Some(user_id) => {
                let num_users = num_users.map_or(1, |n| n as usize);
                let start_key = StableUserId(user_id);
                map.range(start_key..).take(num_users).collect()
            }
            None => {
                let num_users = num_users.map_or(MAX_USERS, |n| n as usize);
                map.iter().take(num_users).collect()
            }
        };

        serde_json::to_string(&users).map_err(|e| format!("Failed to serialize users: {}", e))
    })
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
