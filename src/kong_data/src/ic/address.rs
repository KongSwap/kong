use candid::CandidType;
use ic_ledger_types::AccountIdentifier;
use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};
use std::fmt::{self, Display, Formatter};

/// Represents an address which can be either an Account ID or a Principal ID.
#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub enum Address {
    AccountId(AccountIdentifier),
    PrincipalId(Account),
}

impl Display for Address {
    fn fmt(&self, f: &mut Formatter) -> fmt::Result {
        match self {
            Address::AccountId(account_id) => write!(f, "{}", account_id),
            Address::PrincipalId(principal_id) => write!(f, "{}", principal_id),
        }
    }
}
