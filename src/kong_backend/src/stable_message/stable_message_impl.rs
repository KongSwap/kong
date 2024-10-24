use super::stable_message::StableMessage;

impl StableMessage {
    pub fn new(to_user_id: u32, title: &str, message: &str, ts: u64) -> Self {
        Self {
            message_id: 0,
            to_user_id,
            title: title.to_string(),
            message: message.to_string(),
            ts,
        }
    }
}
