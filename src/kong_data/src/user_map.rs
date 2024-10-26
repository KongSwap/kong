use ic_cdk::update;
use kong_lib::stable_user::stable_user::{StableUser, StableUserId};

use super::guards::caller_is_kong_backend;
use super::stable_memory::USER_MAP;

//#[update(guard = "caller_is_kong_backend")]
fn insert_user(stable_user_id: StableUserId, stable_user: StableUser) -> Result<(), String> {
    USER_MAP.with(|user_map| {
        user_map.borrow_mut().insert(stable_user_id, stable_user);
    });
    Ok(())
}
