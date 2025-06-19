use candid::Principal;
use ic_ledger_types::AccountIdentifier;
use icrc_ledger_types::icrc1::account::Account;
use regex::Regex;
use std::sync::OnceLock;

use crate::stable_token::{stable_token::StableToken, token::Token};
use crate::solana::utils::validation;

use super::address::Address;
use super::icp::is_icp_token_id;

static PRINCIPAL_ID_LOCK: OnceLock<Regex> = OnceLock::new();
const PRINCIPAL_ID_REGEX: &str = r"^([a-z0-9]{5}-){10}[a-z0-9]{3}$|^([a-z0-9]{5}-){4}cai$";
static ACCOUNT_ID_LOCK: OnceLock<Regex> = OnceLock::new();
const ACCOUNT_ID_REGEX: &str = r"^[a-f0-9]{64}$";

pub fn is_principal_id(address: &str) -> bool {
    let regrex_principal_id = PRINCIPAL_ID_LOCK.get_or_init(|| Regex::new(PRINCIPAL_ID_REGEX).unwrap());
    regrex_principal_id.is_match(address)
}

pub fn get_address(token: &StableToken, address: &str) -> Result<Address, String> {
    // Handle Solana tokens first
    if let StableToken::Solana(_) = token {
        // For Solana tokens, validate as Solana address
        validation::validate_address(address)
            .map_err(|e| format!("Invalid Solana address: {}", e))?;
        return Ok(Address::SolanaAddress(address.to_string()));
    }

    // Handle IC tokens (existing logic)
    let regrex_princiapl_id = PRINCIPAL_ID_LOCK.get_or_init(|| Regex::new(PRINCIPAL_ID_REGEX).unwrap());
    let regrex_account_id = ACCOUNT_ID_LOCK.get_or_init(|| Regex::new(ACCOUNT_ID_REGEX).unwrap());

    if regrex_princiapl_id.is_match(address) {
        if !token.is_icrc1() {
            return Err("Principal Id requires ICRC1 token".to_string());
        }
        Ok(Address::PrincipalId(Account::from(
            Principal::from_text(address).map_err(|e| e.to_string())?,
        )))
    } else if regrex_account_id.is_match(address) {
        if is_icp_token_id(token.token_id()) {
            return Err("Account Id supported only for ICP token".to_string());
        }
        Ok(Address::AccountId(AccountIdentifier::from_hex(address).map_err(|e| e.to_string())?))
    } else {
        Err("Invalid address format".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rand::{distributions::Alphanumeric, Rng};

    fn generate_random_string(length: usize) -> String {
        rand::thread_rng()
            .sample_iter(&Alphanumeric)
            .take(length)
            .map(char::from)
            .collect::<String>()
            .to_lowercase()
    }

    fn generate_principal_segment() -> String {
        generate_random_string(5)
    }

    fn generate_valid_principal_id() -> String {
        let mut segments = Vec::new();
        for _ in 0..10 {
            segments.push(generate_principal_segment());
        }
        format!("{}-{}", segments.join("-"), generate_random_string(3))
    }

    fn generate_valid_canister_id() -> String {
        let mut segments = Vec::new();
        for _ in 0..4 {
            segments.push(generate_principal_segment());
        }
        format!("{}-cai", segments.join("-"))
    }

    #[test]
    fn test_is_principal_id_valid() {
        assert!(is_principal_id(&generate_valid_principal_id()));
        assert!(is_principal_id(&generate_valid_canister_id()));
    }

    #[test]
    fn test_is_principal_id_invalid_length() {
        let mut segments_short = Vec::new();
        for _ in 0..9 {
            segments_short.push(generate_principal_segment());
        }
        assert!(!is_principal_id(&format!(
            "{}-{}",
            segments_short.join("-"),
            generate_random_string(3)
        ))); // Too short

        let mut segments_long = Vec::new();
        for _ in 0..11 {
            segments_long.push(generate_principal_segment());
        }
        assert!(!is_principal_id(&format!(
            "{}-{}",
            segments_long.join("-"),
            generate_random_string(3)
        ))); // Too long

        let mut canister_segments_short = Vec::new();
        for _ in 0..3 {
            canister_segments_short.push(generate_principal_segment());
        }
        assert!(!is_principal_id(&format!("{}-cai", canister_segments_short.join("-"))));
        // canister id too short
    }

    #[test]
    fn test_is_principal_id_invalid_characters() {
        let valid_id_uppercase = generate_valid_principal_id().to_uppercase();
        assert!(!is_principal_id(&valid_id_uppercase)); // Uppercase

        let mut segments_special_char = Vec::new();
        for _ in 0..9 {
            segments_special_char.push(generate_principal_segment());
        }
        segments_special_char.push(format!("{}!", generate_random_string(4))); // add a segment with a special char
        assert!(!is_principal_id(&format!(
            "{}-{}",
            segments_special_char.join("-"),
            generate_random_string(3)
        ))); // Special character in segment

        let mut segments_special_char_end = Vec::new();
        for _ in 0..10 {
            segments_special_char_end.push(generate_principal_segment());
        }
        assert!(!is_principal_id(&format!(
            "{}-{}!",
            segments_special_char_end.join("-"),
            generate_random_string(2)
        ))); // Special character at the end

        let mut canister_segments_special = Vec::new();
        for _ in 0..3 {
            canister_segments_special.push(generate_principal_segment());
        }
        canister_segments_special.push(format!("{}!", generate_random_string(4)));
        assert!(!is_principal_id(&format!("{}-cai", canister_segments_special.join("-"))));
        // canister id special character in segment
    }

    #[test]
    fn test_is_principal_id_invalid_format() {
        let mut segments_incorrect_len = Vec::new();
        for _ in 0..9 {
            segments_incorrect_len.push(generate_principal_segment());
        }
        segments_incorrect_len.push(generate_random_string(6)); // incorrect segment length
        assert!(!is_principal_id(&format!(
            "{}-{}",
            segments_incorrect_len.join("-"),
            generate_random_string(3)
        )));

        let mut segments_incorrect_sep = Vec::new();
        for _ in 0..10 {
            segments_incorrect_sep.push(generate_principal_segment());
        }
        assert!(!is_principal_id(&format!(
            "{}_{}",
            segments_incorrect_sep.join("_"),
            generate_random_string(3)
        ))); // incorrect separator

        let mut canister_segments_incorrect_len = Vec::new();
        for _ in 0..3 {
            canister_segments_incorrect_len.push(generate_principal_segment());
        }
        canister_segments_incorrect_len.push(generate_random_string(3)); // incorrect segment length
        assert!(!is_principal_id(&format!("{}-cai", canister_segments_incorrect_len.join("-"))));
    }

    #[test]
    fn test_is_principal_id_empty_string() {
        assert!(!is_principal_id(""));
    }

    #[test]
    fn test_is_principal_id_account_id_format() {
        // This is a valid account id, not a principal id
        let account_id = (0..64)
            .map(|_| format!("{:x}", rand::thread_rng().gen_range(0..16)))
            .collect::<String>();
        assert!(!is_principal_id(&account_id));
    }
}
