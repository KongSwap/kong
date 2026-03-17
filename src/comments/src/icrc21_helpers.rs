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
    use_fields_display: bool,
    fields_intent: &str,
    fields: Vec<(String, Value)>,
    generic_message: String,
) -> ConsentMessage {
    if use_fields_display {
        ConsentMessage::FieldsDisplayMessage(FieldsDisplay {
            intent: fields_intent.to_string(),
            fields,
        })
    } else {
        ConsentMessage::GenericDisplayMessage(generic_message)
    }
}

/// Helper to create standard fields for simple actions
pub fn create_standard_fields(action: &str, requester: &str) -> Vec<(String, Value)> {
    let mut fields = Vec::new();
    add_text_field(&mut fields, "Action", action.to_string());
    add_text_field(&mut fields, "Requester", requester.to_string());
    add_timestamp_field(&mut fields);
    fields
}

/// Helper to check display preference from request
pub fn should_use_fields_display(request: &ConsentMessageRequest) -> bool {
    matches!(
        request.user_preferences.device_spec,
        Some(DisplayMessageType::FieldsDisplay)
    )
}