use candid::Principal;
use ic_ledger_types::{AccountIdentifier, Subaccount};
use icrc_ledger_types::icrc1::account::Account;

pub struct ICNetwork;

impl ICNetwork {
    /// return the current time in nanoseconds
    pub fn get_time() -> u64 {
        ic_cdk::api::time()
    }

    /// Principal ID of the caller.
    pub fn caller() -> Principal {
        ic_cdk::api::msg_caller()
    }

    /// Account of the caller.
    pub fn caller_id() -> Account {
        Account::from(ICNetwork::caller())
    }

    /// Account ID of the caller. Used for ICP token
    pub fn caller_account_id() -> AccountIdentifier {
        let account = ICNetwork::caller_id();
        let subaccount = Subaccount(account.subaccount.unwrap_or([0; 32]));
        AccountIdentifier::new(&account.owner, &subaccount)
    }

    /// Check if the caller is a controller
    pub fn is_caller_controller() -> bool {
        ic_cdk::api::is_controller(&ICNetwork::caller())
    }

    /// Check to make sure Principal Id is not anonymous
    pub fn principal_id_is_not_anonymous(principal_id: &str) -> Result<(), String> {
        if principal_id == Principal::anonymous().to_text() {
            return Err("Anonymous user not allowed".to_string());
        }
        Ok(())
    }

    /// Account Id for Principal Id with subaccount set to zero
    pub fn principal_to_account_id(principal: Principal) -> AccountIdentifier {
        let account = Account::from(principal);
        let subaccount = Subaccount(account.subaccount.unwrap_or([0; 32]));
        AccountIdentifier::new(&account.owner, &subaccount)
    }
}
