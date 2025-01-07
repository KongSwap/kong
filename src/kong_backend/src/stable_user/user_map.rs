use super::principal_id_map;
use super::referral_code::{generate_referral_code, REFERRAL_INTERVAL};
use super::stable_user::{StableUser, StableUserId};

use crate::ic::id::{caller_principal_id, principal_id_is_not_anonymous};
use crate::ic::logging::error_log;
use crate::ic::{get_time::get_time, management::get_pseudo_seed};
use crate::stable_kong_settings::kong_settings_map;
use crate::stable_memory::USER_MAP;

/// return StableUser by user_id
///
/// # Arguments
///
/// * `user_id` - user_id of the user
///
/// # Returns
///
/// * `Some(StableUser)` if user with user_id exists
/// * `None` if user with user_id does not exist
pub fn get_by_user_id(user_id: u32) -> Option<StableUser> {
    USER_MAP.with(|m| m.borrow().get(&StableUserId(user_id)))
}

/// return StableUser by principal_id
///
/// # Arguments
///
/// principal_id - principal_id of the user
///
/// # Returns
///
/// * `Ok(Some(StableUser))` if user is not anonymous, if principal_id is a known user or None if user is not registered
/// * `Err(String)` if user is anonymous
pub fn get_by_principal_id(principal_id: &str) -> Result<Option<StableUser>, String> {
    principal_id_is_not_anonymous(principal_id)?;
    Ok(match principal_id_map::get_user_id(principal_id) {
        Some(user_id) => get_by_user_id(user_id),
        None => None,
    })
}

/// return StableUser of the caller
///
/// # Returns
///
/// * `Ok(Some(StableUser))` if user is not anonymous, if principal_id is a known user or None if user is not registered
/// * `Err(String)` if user is anonymous
pub fn get_by_caller() -> Result<Option<StableUser>, String> {
    get_by_principal_id(&caller_principal_id())
}

/// return StableUser by referral code
///
/// # Arguments
///
/// * `referral_code` - referral code of the user
///
/// # Returns
///
/// * `Some(StableUser)` if user with referral code exists
/// * `None` if user with referral code does not exist
pub fn get_user_by_referral_code(referral_code: &str) -> Option<StableUser> {
    USER_MAP.with(|m| {
        m.borrow()
            .iter()
            .find_map(|(_, v)| if v.my_referral_code == referral_code { Some(v) } else { None })
    })
}

pub fn insert(referred_by: Option<&str>) -> Result<u32, String> {
    let mut update = false;
    let user = match get_by_caller() {
        // if user already exists, return user profile without updating referrer code
        // once a user is created, the referrer code cannot be updated
        Ok(Some(mut user)) => {
            // update last login timestamp to now
            let now = get_time();
            // check if referred_by is expired
            if let Some(referred_by_expires_at) = user.referred_by_expires_at {
                if now > referred_by_expires_at {
                    user.referred_by = None;
                    user.referred_by_expires_at = None;
                    update = true;
                }
            }
            // check if fee_level is expired
            if let Some(fee_level_expires_at) = user.fee_level_expires_at {
                if now > fee_level_expires_at {
                    user.fee_level = 0;
                    user.fee_level_expires_at = None;
                    update = true;
                }
            }
            user
        }
        Ok(None) => {
            // new user, create random user name and referral code
            let mut rng = get_pseudo_seed()?;
            // if referred_by is provided, check if it is a valid referral code
            let (referred_by, referred_by_expires_at) = match referred_by {
                Some(referred) => match get_user_by_referral_code(referred) {
                    Some(referred_user) => (Some(referred_user.user_id), Some(get_time() + REFERRAL_INTERVAL)),
                    None => (None, None),
                },
                None => (None, None),
            };
            let user = StableUser {
                user_id: kong_settings_map::inc_user_map_idx(),
                my_referral_code: generate_referral_code(&mut rng),
                referred_by,
                referred_by_expires_at,
                ..Default::default()
            };
            // insert to principal_id_map
            principal_id_map::insert_principal_id(&user);
            update = true;
            user
        }
        Err(e) => Err(e)?, // do not allow anonymous user
    };

    if update {
        USER_MAP.with(|m| {
            m.borrow_mut().insert(StableUserId(user.user_id), user.clone());
        });
        _ = archive_to_kong_data(&user);
    }

    Ok(user.user_id)
}

fn archive_to_kong_data(user: &StableUser) -> Result<(), String> {
    let user_id = user.user_id;
    let user_json = match serde_json::to_string(user) {
        Ok(user_json) => user_json,
        Err(e) => Err(format!("Failed to serialize user_id #{}. {}", user_id, e))?,
    };

    ic_cdk::spawn(async move {
        let kong_data = kong_settings_map::get().kong_data;
        match ic_cdk::call::<(String,), (Result<String, String>,)>(kong_data, "update_user", (user_json,))
            .await
            .map_err(|e| e.1)
            .unwrap_or_else(|e| (Err(e),))
            .0
        {
            Ok(_) => (),
            Err(e) => error_log(&format!("Failed to archive user_id #{}. {}", user_id, e)),
        };
    });

    Ok(())
}
