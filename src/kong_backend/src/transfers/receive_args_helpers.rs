use crate::transfers::solana::canonical_add_liquidity::CanonicalAddLiquidityMessage;
use crate::{stable_kong_settings::kong_settings_map, transfers::solana::canonical_swap::CanonicalSwapMessage};
use candid::Nat;
use kong_lib::add_liquidity::add_liquidity_args::AddLiquidityArgs;
use kong_lib::swap::swap_args::SwapArgs;
use kong_lib::{
    ic::{address::Address, id::caller_id},
    stable_token::{ic_token::ICToken, solana_token::SolanaToken, stable_token::StableToken},
    stable_transfer::tx_id::TxId,
};
use transfer_lib::{receive::ReceiveArgs, solana::verify_transfer::extract_solana_sender_from_transaction};

pub fn create_add_liquidity_receive_args(token: &StableToken, args: &AddLiquidityArgs, is_token_0: bool) -> Result<ReceiveArgs, String> {
    match token {
        StableToken::LP(_) => Err(format!("LP tokens are not handled by this function")),
        StableToken::IC(ictoken) => {
            let (amount, tx_id) = if is_token_0 {
                (args.amount_0.clone(), args.tx_id_0.clone())
            } else {
                (args.amount_1.clone(), args.tx_id_1.clone())
            };
            create_receive_args_ic(ictoken, &amount, &tx_id)
        }
        StableToken::Solana(solana_token) => {
            create_receive_args_sol(solana_token, AvailableCanonicalMessages::AddLiquidity(args, is_token_0))
        }
    }
}

pub fn create_swap_receive_args(token: &StableToken, args: &SwapArgs) -> Result<ReceiveArgs, String> {
    match token {
        StableToken::LP(_) => Err(format!("LP tokens are not handled by this function")),
        StableToken::IC(ictoken) => create_receive_args_ic(ictoken, &args.pay_amount, &args.pay_tx_id),
        StableToken::Solana(solana_token) => create_receive_args_sol(solana_token, AvailableCanonicalMessages::Swap(args)),
    }
}

fn create_receive_args_ic(_token: &ICToken, amount: &Nat, tx_id: &Option<TxId>) -> Result<ReceiveArgs, String> {
    let from_addr = Address::PrincipalId(caller_id());
    let kong_settings = kong_settings_map::get();
    let kong_backend_account = Address::PrincipalId(kong_settings.kong_backend.clone());
    let amount = amount.clone();
    match tx_id {
        Some(txid) => {
            let txid = match txid {
                TxId::BlockIndex(txid) => txid.clone(),
                _ => Err("Invalid txid value, expected BlockIndex".to_string())?,
            };
            Ok(ReceiveArgs::ic_transfer(txid, from_addr, kong_backend_account, amount))
        }
        None => Ok(ReceiveArgs::ic_approve(from_addr, kong_backend_account, amount)),
    }
}

enum AvailableCanonicalMessages<'a> {
    Swap(&'a SwapArgs),
    AddLiquidity(&'a AddLiquidityArgs, bool),
}

fn create_receive_args_sol(token: &SolanaToken, args: AvailableCanonicalMessages) -> Result<ReceiveArgs, String> {
    let (txid, signature, amount) = match args {
        AvailableCanonicalMessages::Swap(args) => (args.pay_tx_id.clone(), args.pay_signature.clone(), args.pay_amount.clone()),
        AvailableCanonicalMessages::AddLiquidity(args, is_token_0) => {
            if is_token_0 {
                (args.tx_id_0.clone(), args.signature_0.clone(), args.amount_0.clone())
            } else {
                (args.tx_id_1.clone(), args.signature_1.clone(), args.amount_1.clone())
            }
        }
    };

    let txid = txid.ok_or("pay tx id is required for solana".to_string())?;
    let txid = if let TxId::TransactionId(txid) = txid.clone() {
        txid
    } else {
        return Err("Invalid pay_tx_id type, expected TransactionId".to_string());
    };

    let signature = signature.clone().ok_or("pay signature is required for solana".to_string())?;

    let sender_pubkey = match extract_solana_sender_from_transaction(&txid, token.is_spl_token) {
        Ok(pubkey) => pubkey,
        Err(e) => return Err(e),
        // TODO: think about retries
        // Err(e) if e.contains("not found") || e.contains("Make sure kong_rpc has processed") => {
        //     if attempt < 9 {
        //         // Wait 2 seconds before retry
        //         use std::time::Duration;
        //         let (sender, receiver) = futures::channel::oneshot::channel();
        //         ic_cdk_timers::set_timer(Duration::from_millis(2000), move || {
        //             let _ = sender.send(());
        //         });
        //         let _ = receiver.await;
        //         continue; // Retry sender extraction
        //     } else {
        //         // Max retries reached
        //         request_map::update_status(
        //             request_id,
        //             StatusCode::VerifyPayTokenFailed,
        //             Some("Transaction not found after retries"),
        //         );
        //         let _ = archive_to_kong_data(request_id);
        //         return;
        //     }
        // }
        // Err(e) => {
        //     // Real error, don't retry
        //     request_map::update_status(request_id, StatusCode::VerifyPayTokenFailed, Some(&e));
        //     let _ = archive_to_kong_data(request_id);
        //     return;
        // }
    };

    let canonical_message = match args {
        AvailableCanonicalMessages::Swap(args) => CanonicalSwapMessage::from_swap_args(args)
            .with_sender(sender_pubkey.clone())
            .to_signing_message(),
        AvailableCanonicalMessages::AddLiquidity(args, _) => CanonicalAddLiquidityMessage::from_add_liquidity_args(args)
            // TODO: why sender is unused?
            // .with_sender(sender_pubkey.clone())
            .to_signing_message(),
    };

    Ok(ReceiveArgs::solana_args(txid, signature, amount, canonical_message))
}
