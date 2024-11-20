use ic_cdk::query;
use kong_lib::stable_user::stable_user::StableUserId;
use std::collections::BTreeMap;

use crate::ic::guards::caller_is_kingkong;
use crate::stable_memory::USER_MAP;

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
