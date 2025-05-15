use candid::{Nat, Principal};
use icrc_ledger_types::icrc::generic_value::ICRC3Value;
use icrc_ledger_types::icrc1::account::Account;
use std::collections::BTreeMap;

const SUBACCOUNT_LENGTH: usize = 32;

#[derive(Debug)]
pub struct ParsedICRC3TransactionInfo {
    pub op: String,
    pub timestamp: u64,
    pub amount: Nat,
    pub from: Account,
    pub to: Option<Account>,
    pub spender: Option<Account>,
}

pub fn try_decode_icrc3_account_value(icrc3_value_arr: &[ICRC3Value]) -> Option<Account> {
    if let Some(ICRC3Value::Blob(blob)) = icrc3_value_arr.first() {
        if let Ok(owner) = Principal::try_from_slice(blob) {
            let subaccount = if icrc3_value_arr.len() >= 2 {
                icrc3_value_arr.get(1).and_then(|val| match val {
                    ICRC3Value::Blob(blob2) if blob2.len() == SUBACCOUNT_LENGTH => blob2.as_slice().try_into().ok(),
                    _ => None,
                })
            } else {
                None
            };
            return Some(Account { owner, subaccount });
        }
    }

    if icrc3_value_arr.len() == 1 {
        if let Some(ICRC3Value::Blob(blob)) = icrc3_value_arr.first() {
            if let Ok(map) = ciborium::de::from_reader::<BTreeMap<String, ciborium::value::Value>, _>(blob.as_slice()) {
                let owner_bytes = match map.get("owner") {
                    Some(ciborium::value::Value::Bytes(bytes)) => bytes.as_slice(),
                    _ => return None,
                };
                let owner = Principal::try_from_slice(owner_bytes).ok()?;
                let subaccount = map.get("subaccount").and_then(|val| match val {
                    ciborium::value::Value::Bytes(bytes) if !bytes.is_empty() && bytes.len() == SUBACCOUNT_LENGTH => {
                        let mut sa = [0u8; SUBACCOUNT_LENGTH];
                        sa.copy_from_slice(bytes);
                        Some(sa)
                    }
                    _ => None,
                });
                return Some(Account { owner, subaccount });
            }
        }
    }
    None
}
