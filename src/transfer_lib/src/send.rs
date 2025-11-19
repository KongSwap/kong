use candid::Nat;
use kong_lib::{
    ic::{
        address::Address,
        get_time,
        transfer::{icp_transfer, icrc1_transfer},
    },
    stable_token::stable_token::StableToken,
    stable_transfer::{stable_transfer::StableTransfer, tx_id::TxId},
};

use crate::{
    solana::{create_job::create_solana_swap_job, send_info::SendInfo},
    transfer_map,
};

pub async fn send(token: &StableToken, dst_address: &Address, amount: &Nat, send_info: SendInfo) -> Result<StableTransfer, String> {
    fn ok_transfer(transfer: StableTransfer) -> Result<StableTransfer, String> {
        let transfer_id = transfer_map::insert(&transfer);
        let transfer = transfer_map::get_by_transfer_id(transfer_id).unwrap_or(transfer);

        return Ok(transfer);
    }

    match token {
        StableToken::LP(_) => Err("this metod does not support to send lp tokens")?,
        StableToken::IC(ic_token) => {
            let tx_id = match dst_address {
                Address::AccountId(to_account_id) => icp_transfer(amount, to_account_id, token, None).await?,
                Address::PrincipalId(to_principal_id) => icrc1_transfer(amount, to_principal_id, token, None).await?,
                Address::SolanaAddress(_) => return Err("IC token transfer with solana address not supported".to_string()),
            };

            let now =  send_info.ts.unwrap_or(get_time::get_time());

            let transfer = StableTransfer {
                transfer_id: 0,
                request_id: send_info.request_id,
                is_send: false,
                amount: amount.clone(),
                token_id: ic_token.token_id,
                tx_id: TxId::BlockIndex(tx_id),
                ts: now,
            };

            return ok_transfer(transfer);
        }
        StableToken::Solana(solana_token) => {
            let now = get_time::get_time();
            let job_id = create_solana_swap_job(&solana_token, &amount, &dst_address, &send_info, now).await?;

            let transfer = StableTransfer {
                transfer_id: 0,
                request_id: send_info.request_id,
                is_send: false,
                amount: amount.clone(),
                token_id: solana_token.token_id,
                tx_id: TxId::TransactionId(format!("job_{}", job_id)),
                ts: now,
            };

            return ok_transfer(transfer);
        }
    }

    Err("Unimplemented".to_string())
}
