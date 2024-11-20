use ic_cdk::{query, update};
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::{USER_MAP, USER_OLD_MAP};
use crate::stable_user::stable_user::{StableUser, StableUserId};

const MAX_USERS: usize = 1_000;

/// serialize USER_MAP for backup
#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_users(user_id: Option<u32>, num_users: Option<u16>) -> Result<String, String> {
    USER_MAP.with(|m| {
        let map = m.borrow();
        let users: BTreeMap<_, _> = match user_id {
            Some(user_id) => {
                let start_id = StableUserId(user_id);
                let num_users = num_users.map_or(1, |n| n as usize);
                map.range(start_id..).take(num_users).collect()
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
fn update_users(stable_users_json: String) -> Result<String, String> {
    let users: BTreeMap<StableUserId, StableUser> = match serde_json::from_str(&stable_users_json) {
        Ok(users) => users,
        Err(e) => return Err(format!("Invalid users: {}", e)),
    };

    USER_MAP.with(|user_map| {
        let mut map = user_map.borrow_mut();
        for (k, v) in users {
            map.insert(k, v);
        }
    });

    Ok("Users updated".to_string())
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

/*
#[update(hidden = true, guard = "caller_is_kingkong")]
fn backup_alt_users(user_id: Option<u32>, num_users: Option<u16>) -> Result<String, String> {
    USER_ALT_MAP.with(|m| {
        let map = m.borrow();
        let users: BTreeMap<_, _> = match user_id {
            Some(user_id) => {
                let start_id = StableUserIdAlt(user_id);
                let num_users = num_users.map_or(1, |n| n as usize);
                map.range(start_id..).take(num_users).collect()
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
fn upgrade_users() -> Result<String, String> {
    USER_ALT_MAP.with(|m| {
        let user_alt_map = m.borrow();
        USER_MAP.with(|m| {
            let mut user_map = m.borrow_mut();
            user_map.clear_new();
            for (k, v) in user_alt_map.iter() {
                let user_id = StableUserIdAlt::to_stable_user_id(&k);
                let user = StableUserAlt::to_stable_user(&v);
                user_map.insert(user_id, user);
            }
        });
    });

    Ok("Users upgraded".to_string())
}
*/

#[update(hidden = true, guard = "caller_is_kingkong")]
pub fn upgrade_users() -> Result<String, String> {
    USER_OLD_MAP.with(|m| {
        let user_old_map = m.borrow();
        USER_MAP.with(|m| {
            let mut user_map = m.borrow_mut();
            user_map.clear_new();
            for (k, v) in user_old_map.iter() {
                let user_id = StableUserId::from_old(&k);
                let user = StableUser::from_old(&v);
                user_map.insert(user_id, user);
            }
        });
    });

    Ok("Old users upgraded".to_string())
}
