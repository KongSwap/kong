use ic_cdk::api::time;
use crate::state::*;
use crate::types::*;

#[ic_cdk::update]
pub fn create_message(content: String) -> Result<Message, String> {
    let caller = ic_cdk::api::caller();
    let current_time = time();
    
    // Check if user is sending messages too quickly
    let can_send = LAST_MESSAGE_TIME.with(|last_time_map| {
        let mut map = last_time_map.borrow_mut();
        if let Some(last_time) = map.get(&caller) {
            if current_time - last_time < MIN_MESSAGE_INTERVAL_NS {
                false
            } else {
                map.insert(caller, current_time);
                true
            }
        } else {
            map.insert(caller, current_time);
            true
        }
    });
    
    if !can_send {
        return Err(format!(
            "You're sending messages too quickly. Please wait at least {} seconds between messages.", 
            MIN_MESSAGE_INTERVAL_NS / 1_000_000_000
        ));
    }

    let censored_content = validate_message(&content)?;

    let id = MESSAGE_COUNTER.with(|counter| {
        let next_id = *counter.borrow();
        *counter.borrow_mut() = next_id + 1;
        next_id
    });

    let message = Message {
        id,
        message: censored_content,
        principal: caller,
        created_at: current_time,
    };

    // Store in stable memory
    MESSAGE_STORE.with(|store| {
        store.borrow_mut().insert(id, message.clone());
    });

    Ok(message)
} 