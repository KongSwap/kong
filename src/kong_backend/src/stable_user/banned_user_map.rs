use crate::ic::get_time::get_time;
use crate::stable_memory::BANNED_USERS;

const MAX_CONSECUTIVE_ERRORS: u8 = 10;
const BAN_DURATION: u64 = 3_600_000_000_000; // 1 hour in nanoseconds

pub struct BannedUser {
    pub num_consecutive_errors: u8,
    pub banned_until: Option<u64>,
}

pub fn is_banned_user(user_id: u32) -> Option<u64> {
    BANNED_USERS.with(|m| {
        let mut map = m.borrow_mut();
        if let Some(user) = map.get(&user_id) {
            if let Some(banned_until) = user.banned_until {
                if banned_until > get_time() {
                    return Some(banned_until);
                }
                // lift ban
                map.remove(&user_id);
            }
        }
        None
    })
}

pub fn increase_consecutive_error(user_id: u32) {
    BANNED_USERS.with(|m| {
        let mut map = m.borrow_mut();
        if let Some(user) = map.get_mut(&user_id) {
            user.num_consecutive_errors += 1;
            if user.num_consecutive_errors >= MAX_CONSECUTIVE_ERRORS {
                user.banned_until = Some(get_time() + BAN_DURATION);
            }
        } else {
            map.insert(
                user_id,
                BannedUser {
                    num_consecutive_errors: 1,
                    banned_until: None,
                },
            );
        }
    });
}

pub fn reset_consecutive_error(user_id: u32) {
    BANNED_USERS.with(|m| {
        let mut map = m.borrow_mut();
        map.remove(&user_id);
    });
}
