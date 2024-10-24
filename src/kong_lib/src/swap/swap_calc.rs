use candid::{CandidType, Nat};
use serde::{Deserialize, Serialize};

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub struct SwapCalc {
    pub pool_id: u32,
    // pay and receive are from the point of view of the user
    pub pay_token_id: u32,
    pub pay_amount: Nat,
    pub receive_token_id: u32,
    pub receive_amount: Nat, // does not include any fees. used to keep a constant K with pay amount
    pub lp_fee: Nat,         // will be in receive_token
    pub gas_fee: Nat,        // will be in receive_token
}
