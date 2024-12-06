use ic_cdk::{query, update};
use std::collections::BTreeMap;

use crate::ic::get_time::get_time;
use crate::ic::guards::{caller_is_kingkong, caller_is_kong_backend};
use crate::stable_memory::USER_MAP;
use crate::stable_update::stable_update::{StableMemory, StableUpdate};
use crate::stable_update::update_map;
use crate::stable_user::stable_user::{StableUser, StableUserId};

const MAX_USERS: usize = 1_000;

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

#[update(hidden = true, guard = "caller_is_kong_backend")]
fn update_user(stable_user_json: String) -> Result<String, String> {
    let user: StableUser = match serde_json::from_str(&stable_user_json) {
        Ok(user) => user,
        Err(e) => return Err(format!("Invalid user: {}", e)),
    };

    USER_MAP.with(|user_map| {
        let mut map = user_map.borrow_mut();
        map.insert(StableUserId(user.user_id), user.clone());
    });

    // add to UpdateMap for archiving to database
    let ts = get_time();
    let update = StableUpdate {
        update_id: 0,
        stable_memory: StableMemory::UserMap(user),
        ts,
    };
    update_map::insert(&update);

    Ok("User updated".to_string())
}
