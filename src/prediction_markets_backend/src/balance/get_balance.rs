use candid::{Nat, Principal};
use ic_cdk::query;
use icrc_ledger_types::icrc1::account::Account;
use num_traits::ToPrimitive;

use crate::nat::*;
use crate::KONG_LEDGER_ID;

#[query]
pub async fn get_balance(user: Principal) -> StorableNat {
    let args = Account {
        owner: user,
        subaccount: None,
    };
    let ledger = Principal::from_text(KONG_LEDGER_ID).expect("Invalid ledger ID");

    match ic_cdk::call::<(Account,), (Nat,)>(ledger, "icrc1_balance_of", (args,)).await {
        Ok((balance,)) => StorableNat::from(balance.0.to_u64().unwrap_or(0)),
        Err(_) => StorableNat::from(0u64),
    }
}
