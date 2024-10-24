use candid::CandidType;
use ic_ledger_types::AccountIdentifier;
use icrc_ledger_types::icrc1::account::Account;
use serde::{Deserialize, Serialize};

/// Represents an address which can be either an Account ID or a Principal ID.
#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub enum Address {
    AccountId(AccountIdentifier),
    PrincipalId(Account),
}
