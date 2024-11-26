use candid::{CandidType, Nat};
use num::rational::BigRational;
use serde::{Deserialize, Serialize};

use crate::helpers::nat_helpers::{nat_add, nat_subtract, nat_to_bigint, nat_to_decimal_precision, nat_zero};
use crate::stable_token::token::Token;
use crate::stable_token::token_map;

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

impl SwapCalc {
    /// this is the net amount the user will receive after the fees and gas are taken off
    /// this is used for price calculations
    pub fn receive_amount_with_fees_and_gas(&self) -> Nat {
        let total_fees = nat_add(&self.lp_fee, &self.gas_fee);
        nat_subtract(&self.receive_amount, &total_fees).unwrap_or(nat_zero())
    }

    pub fn get_price(&self) -> Option<BigRational> {
        let pay_token = token_map::get_by_token_id(self.pay_token_id)?;
        let receive_token = token_map::get_by_token_id(self.receive_token_id)?;
        let max_decimals = std::cmp::max(pay_token.decimals(), receive_token.decimals());
        let pay_amount_in_max_decimals = nat_to_bigint(&nat_to_decimal_precision(&self.pay_amount, pay_token.decimals(), max_decimals));
        let receive_amount_in_max_decimals = nat_to_bigint(&nat_to_decimal_precision(
            &self.receive_amount_with_fees_and_gas(),
            receive_token.decimals(),
            max_decimals,
        ));

        Some(BigRational::new(receive_amount_in_max_decimals, pay_amount_in_max_decimals))
    }
}
