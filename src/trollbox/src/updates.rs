use ic_cdk::api::time;
use crate::state::*;
use crate::types::*;

#[ic_cdk::update]
pub fn create_message(content: String) -> Result<Message, String> {
    let censored_content = validate_message(&content)?;

    let id = MESSAGE_COUNTER.with(|counter| {
        let next_id = *counter.borrow();
        *counter.borrow_mut() = next_id + 1;
        next_id
    });

    let message = Message {
        id,
        message: censored_content,
        principal: ic_cdk::api::caller(),
        created_at: time(),
    };

    // Store in stable memory
    MESSAGE_STORE.with(|store| {
        store.borrow_mut().insert(id, message.clone());
    });

    Ok(message)
} 