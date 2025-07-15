use candid::Nat;

pub fn nat_option_to_string(value: Option<&Nat>) -> String {
    match value {
        Some(nat) => nat.to_string(),
        None => "None".to_string(),
    }
}
