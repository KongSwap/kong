use kong_lib::{ic::{address::Address, id}, stable_token::stable_token::StableToken, stable_transfer::tx_id::TxId};

// TODO: test refund icp, refunc icrc, refund sol
pub fn get_caller_address(token: &StableToken, tx_id: Option<&TxId>) -> Result<Address, String> {
    match token {
        StableToken::LP(_) => Err("taking address for lp token not supported".to_string())?,
        StableToken::IC(ictoken) => {
            if ictoken.is_icp()
            {
                Ok(Address::AccountId(id::caller_account_id()))
            }
            else
            {
                Ok(Address::PrincipalId(id::caller_id()))
            }
        },
        StableToken::Solana(solana_token) => {
            let tx_id = match tx_id {
                Some(tx_id) => tx_id,
                None => Err("tx_id is required for taking solana address".to_string())?,
            };
            crate::solana::get_address::get_caller_address(solana_token, tx_id)
        },
    }
}
