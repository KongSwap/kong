use candid::Nat;

use super::swap_amounts::swap_amounts;
use super::swap_calc::SwapCalc;

use crate::helpers::{math_helpers::round_f64, nat_helpers::nat_to_decimals_f64};
use crate::stable_token::{stable_token::StableToken, token::Token};

pub fn calculate_amounts(
    pay_token: &StableToken,
    pay_amount: &Nat,
    receive_token: &StableToken,
    user_receive_amount: Option<&Nat>,
    user_max_slippage: f64,
) -> Result<(Nat, f64, f64, f64, Vec<SwapCalc>), String> {
    let (receive_amount, price, mid_price, slippage, txs) = swap_amounts(pay_token, pay_amount, receive_token)?;

    // check if receive_amount is within user's specified
    if let Some(user_receive_amount) = user_receive_amount {
        if receive_amount < *user_receive_amount {
            let decimals = receive_token.decimals();
            let receive_amount_with_fees_and_gas_f64 = round_f64(nat_to_decimals_f64(decimals, &receive_amount).unwrap_or(0_f64), decimals);
            return Err(format!(
                "Insufficient receive amount. Can only receive {} {} with {}% slippage",
                receive_amount_with_fees_and_gas_f64,
                receive_token.symbol(),
                slippage
            ));
        }
    }

    // check if slippage is within user's specified
    if slippage > user_max_slippage {
        let decimals = receive_token.decimals();
        let receive_amount_with_fees_and_gas_f64 = round_f64(nat_to_decimals_f64(decimals, &receive_amount).unwrap_or(0_f64), decimals);
        return Err(format!(
            "Slippage exceeded. Can only receive {} {} with {}% slippage",
            receive_amount_with_fees_and_gas_f64,
            receive_token.symbol(),
            slippage
        ));
    }

    Ok((receive_amount, mid_price, price, slippage, txs))
}
