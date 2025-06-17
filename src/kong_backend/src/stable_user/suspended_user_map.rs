use crate::ic::network::ICNetwork;
use crate::stable_memory::SUSPENDED_USERS;

const MAX_CONSECUTIVE_ERRORS: u8 = 10;
const SUSPEND_DURATION: u64 = 3_600_000_000_000; // 1 hour in nanoseconds

pub struct SuspendedUser {
    pub num_consecutive_errors: u8,
    pub suspended_until: Option<u64>,
}

pub fn is_suspended_user(user_id: u32) -> Option<u64> {
    SUSPENDED_USERS.with(|m| {
        let mut map = m.borrow_mut();
        if let Some(user) = map.get(&user_id) {
            if let Some(suspended_until) = user.suspended_until {
                if suspended_until > ICNetwork::get_time() {
                    return Some(suspended_until);
                }
                // lift suspension if the time has passed
                map.remove(&user_id);
            }
        }
        None
    })
}

pub fn increase_consecutive_error(user_id: u32) {
    SUSPENDED_USERS.with(|m| {
        let mut map = m.borrow_mut();
        if let Some(user) = map.get_mut(&user_id) {
            user.num_consecutive_errors += 1;
            if user.num_consecutive_errors >= MAX_CONSECUTIVE_ERRORS {
                user.suspended_until = Some(ICNetwork::get_time() + SUSPEND_DURATION);
            }
        } else {
            map.insert(
                user_id,
                SuspendedUser {
                    num_consecutive_errors: 1,
                    suspended_until: None,
                },
            );
        }
    });
}

pub fn reset_consecutive_error(user_id: u32) {
    SUSPENDED_USERS.with(|m| {
        let mut map = m.borrow_mut();
        map.remove(&user_id);
    });
}
