use ic_cdk::api::caller;
use crate::state::*;
use candid::Principal;
/// Check if the caller is an admin
fn caller_is_admin() -> bool {
    let caller_principal = caller();
    ADMINS.with(|admins| {
        admins.borrow().contains(&caller_principal)
    })
}

/// Check if a specific principal is an admin
#[ic_cdk::query]
pub fn is_admin(principal: String) -> bool {
    // Convert string to Principal
    match candid::Principal::from_text(principal) {
        Ok(principal_obj) => {
            ADMINS.with(|admins| {
                admins.borrow().contains(&principal_obj)
            })
        },
        Err(_) => {
            // Invalid principal string format
            false
        }
    }
}

/// Initialize the first admin (should be called during canister initialization)
pub fn init_admin() {
    let deployer = caller();
    ADMINS.with(|admins| {
        let mut admins_mut = admins.borrow_mut();
        admins_mut.insert(deployer);
        
        // Add specified principal as a default admin
        match candid::Principal::from_text("hkxzv-wmenl-q4d3b-j3o5s-yucpn-g5itu-b3zmq-hxggl-s3atg-vryjf-dqe") {
            Ok(principal) => {
                admins_mut.insert(principal);
            },
            Err(_) => {
                ic_cdk::println!("Failed to parse principal for default admin");
            }
        }
    });
}

/// Allows admins to add new admins
#[ic_cdk::update]
pub fn add_admin(principal: String) -> Result<(), String> {
    if !caller_is_admin() {
        return Err("Unauthorized: Only admins can add new admins".to_string());
    }
    
    ADMINS.with(|admins| {
        admins.borrow_mut().insert(Principal::from_text(principal).unwrap());
    });
    
    Ok(())
}

/// Allows admins to delete any message
#[ic_cdk::update]
pub fn delete_message(message_id: u64) -> Result<(), String> {
    // Check if caller is an admin
    if !caller_is_admin() {
        return Err("Unauthorized: Only admins can delete messages".to_string());
    }
    
    // Check if the message exists
    let message_exists = MESSAGE_STORE.with(|store| {
        store.borrow().contains_key(&message_id)
    });
    
    if !message_exists {
        return Err(format!("Message with ID {} not found", message_id));
    }
    
    // Delete the message
    MESSAGE_STORE.with(|store| {
        store.borrow_mut().remove(&message_id);
    });
    
    Ok(())
}

/// Allows admins to ban a user for a specified number of days
#[ic_cdk::update]
pub fn ban_user(user_principal: candid::Principal, days: u64) -> Result<(), String> {
    // Check if caller is an admin
    if !caller_is_admin() {
        return Err("Unauthorized: Only admins can ban users".to_string());
    }
    
    // Convert days to nanoseconds and add to current time
    let ban_duration_ns = days * 24 * 60 * 60 * 1_000_000_000;
    let current_time = ic_cdk::api::time();
    let ban_expiry = current_time + ban_duration_ns;
    
    // Add user to banned list (using stable storage)
    BANNED_USERS_STORE.with(|banned_users| {
        banned_users.borrow_mut().insert(
            PrincipalStorable(user_principal),
            ExpiryTimeStorable(ban_expiry)
        );
    });
    
    Ok(())
}

/// Allows admins to unban a user
#[ic_cdk::update]
pub fn unban_user(user_principal: candid::Principal) -> Result<(), String> {
    // Check if caller is an admin
    if !caller_is_admin() {
        return Err("Unauthorized: Only admins can unban users".to_string());
    }
    
    // Remove user from banned list (using stable storage)
    BANNED_USERS_STORE.with(|banned_users| {
        banned_users.borrow_mut().remove(&PrincipalStorable(user_principal));
    });
    
    Ok(())
}

/// Check if a user is banned and return the remaining ban time in seconds
#[ic_cdk::query]
pub fn check_ban_status(user_principal: candid::Principal) -> Option<u64> {
    is_user_banned(&user_principal)
} 