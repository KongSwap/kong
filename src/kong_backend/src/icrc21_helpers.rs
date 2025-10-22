use icrc_ledger_types::icrc21::requests::{ConsentMessageRequest, DisplayMessageType};
use icrc_ledger_types::icrc21::responses::{ConsentMessage, FieldsDisplay, Value};

/// Helper to add a timestamp field to the fields vector
pub fn add_timestamp_field(fields: &mut Vec<(String, Value)>) {
    let timestamp_nanos = ic_cdk::api::time();
    let timestamp_secs = timestamp_nanos / 1_000_000_000;
    fields.push(("Timestamp".to_string(), Value::TimestampSeconds {
        amount: timestamp_secs
    }));
}

/// Helper to add a text field to the fields vector
pub fn add_text_field(fields: &mut Vec<(String, Value)>, name: &str, content: String) {
    fields.push((name.to_string(), Value::Text { content }));
}

/// Helper to create a consent message based on display preference
pub fn create_consent_message(
    use_fields: bool,
    intent: &str,
    fields: Vec<(String, Value)>,
    generic_msg: String,
) -> ConsentMessage {
    if use_fields {
        ConsentMessage::FieldsDisplayMessage(FieldsDisplay {
            intent: intent.to_string(),
            fields,
        })
    } else {
        ConsentMessage::GenericDisplayMessage(generic_msg)
    }
}

/// Helper to check display preference from request
pub fn should_use_fields_display(request: &ConsentMessageRequest) -> bool {
    matches!(
        request.user_preferences.device_spec,
        Some(DisplayMessageType::FieldsDisplay)
    )
}