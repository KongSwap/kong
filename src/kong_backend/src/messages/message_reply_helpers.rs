use super::message_reply::MessagesReply;

use crate::stable_message::stable_message::StableMessage;

// creates a MessagesReply from a StableMessage
pub fn to_messages_reply(message: &StableMessage) -> MessagesReply {
    MessagesReply {
        message_id: message.message_id,
        title: message.title.clone(),
        message: message.message.clone(),
        ts: message.ts,
    }
}
