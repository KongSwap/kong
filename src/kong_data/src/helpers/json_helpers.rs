use serde_json::Value;

// Generic function to merge two JSON values
pub fn merge(original: &mut Value, updates: &Value) {
    match (original, updates) {
        (Value::Object(original), Value::Object(updates)) => {
            for (key, value) in updates {
                merge(original.entry(key).or_insert(Value::Null), value);
            }
        }
        (original, updates) => {
            *original = updates.clone();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_merge() {
        let mut original = json!({
            "name": "John",
            "age": 30,
            "address": {
                "city": "New York",
                "zip": "10001"
            }
        });

        let updates = json!({
            "age": 31,
            "address": {
                "zip": "10002",
                "street": "5th Avenue"
            },
            "email": "john.doe@example.com"
        });

        let expected = json!({
            "name": "John",
            "age": 31,
            "address": {
                "city": "New York",
                "zip": "10002",
                "street": "5th Avenue"
            },
            "email": "john.doe@example.com"
        });

        merge(&mut original, &updates);
        assert_eq!(original, expected);
    }
}
