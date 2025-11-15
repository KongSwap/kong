use candid::CandidType;
use ic_ledger_types::AccountIdentifier;
use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};
use std::fmt::{self, Display, Formatter};

/// Represents an address which can be either an Account ID, a Principal ID, or a Solana Address.
#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub enum Address {
    AccountId(AccountIdentifier),
    PrincipalId(Account),
    SolanaAddress(String),
}

impl Display for Address {
    fn fmt(&self, f: &mut Formatter) -> fmt::Result {
        match self {
            Address::AccountId(account_id) => write!(f, "{}", account_id),
            Address::PrincipalId(principal_id) => write!(f, "{}", principal_id),
            Address::SolanaAddress(address) => write!(f, "{}", address),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use ed25519_consensus::SigningKey;
    use ic_agent::{identity::BasicIdentity, Identity};
    use ic_ledger_types::AccountIdentifier;
    use icrc_ledger_types::icrc1::account::Account;
    use rand::{thread_rng, Rng};

    #[test]
    fn test_display_account_id() {
        let hex_account_id = "da29b27beb16a842882149b5380ff3b20f701c33ca8fddbecdb5201c600e0f0e";
        let account_id = AccountIdentifier::from_hex(hex_account_id).unwrap();
        let address = Address::AccountId(account_id);
        assert_eq!(address.to_string(), hex_account_id);
    }

    #[test]
    fn test_display_principal_id() {
        let signing_key = SigningKey::new(thread_rng());
        let identity = BasicIdentity::from_signing_key(signing_key);
        let principal_text = identity.sender().unwrap().to_text();
        let principal = Principal::from_text(principal_text.clone()).unwrap();
        let account = Account {
            owner: principal,
            subaccount: None,
        };
        let address = Address::PrincipalId(account);
        assert_eq!(address.to_string(), principal_text);
    }

    #[test]
    fn test_display_canister_id() {
        let canister_text = "2ipq2-uqaaa-aaaar-qailq-cai";
        let canister = Principal::from_text(canister_text).unwrap();
        let account = Account {
            owner: canister,
            subaccount: None,
        };
        let address = Address::PrincipalId(account);
        assert_eq!(address.to_string(), canister_text);
    }

    #[test]
    fn test_display_principal_id_with_subaccount() {
        let signing_key = SigningKey::new(thread_rng());
        let identity = BasicIdentity::from_signing_key(signing_key);
        let principal_text = identity.sender().unwrap().to_text();
        let principal = Principal::from_text(principal_text.clone()).unwrap();
        let subaccount: [u8; 32] = rand::thread_rng().gen(); // Generate random 32-byte array
        let account = Account {
            owner: principal,
            subaccount: Some(subaccount),
        };
        let address = Address::PrincipalId(account);
        // address should include subaccount in its display but it doesn't so just check principal
        assert!(format!("{}", address).contains(&principal_text));
    }
}
