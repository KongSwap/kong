use crate::{solana::verify_transfer::SolanaVerificationResult, verify_transfer};
use candid::Nat;
use kong_lib::ic::transfer::icrc2_transfer_from;
use kong_lib::{ic::address::Address, stable_token::stable_token::StableToken, stable_transfer::tx_id::TxId};

pub struct ReceiveArgs {
    pub txid: Option<TxId>,
    pub sender_addr: Option<Address>,
    pub receive_addr: Option<Address>,
    pub signature: Option<String>,
    pub amount: Option<Nat>, // Used for verification and
    pub canonical_message: Option<String>,
}

impl ReceiveArgs {
    pub fn ic_approve(sender_addr: Address, receive_addr: Address, amount: Nat) -> ReceiveArgs {
        ReceiveArgs {
            txid: None,
            sender_addr: Some(sender_addr),
            receive_addr: Some(receive_addr),
            signature: None,
            amount: Some(amount),
            canonical_message: None,
        }
    }

    pub fn ic_transfer(block: Nat, sender_addr: Address, receive_addr: Address, amount: Nat) -> ReceiveArgs {
        ReceiveArgs {
            txid: Some(TxId::BlockIndex(block)),
            sender_addr: Some(sender_addr),
            receive_addr: Some(receive_addr),
            signature: None,
            amount: Some(amount),
            canonical_message: None,
        }
    }

    pub fn solana_args(txid: String, signature: String, amount: Nat, canonical_message: String) -> ReceiveArgs {
        ReceiveArgs {
            txid: Some(TxId::TransactionId(txid)),
            sender_addr: None,
            receive_addr: None,
            signature: Some(signature),
            amount: Some(amount),
            canonical_message: Some(canonical_message),
        }
    }
}

pub struct ReceiveResult {
    pub amount: Nat,
    pub tx_signature: String,
}

impl ReceiveResult {
    fn sol(sol_res: SolanaVerificationResult) -> ReceiveResult {
        ReceiveResult {
            amount: sol_res.amount,
            tx_signature: sol_res.tx_signature,
        }
    }

    fn ic(amount: Nat) -> ReceiveResult {
        ReceiveResult {
            amount: amount,
            tx_signature: String::new(),
        }
    }
}

pub async fn receive(token: &StableToken, args: ReceiveArgs) -> Result<ReceiveResult, String> {
    let txid = args.txid.clone();
    let res = match &txid {
        Some(txid) => match token {
            StableToken::LP(_) => return Err("receive lp is not supported".to_string()),
            StableToken::IC(_) => {
                let amount = &args
                    .amount
                    .ok_or("ic tx, invalid input parameter: amount is required".to_string())?;
                let receiver = args.receive_addr.ok_or("ic tx, reciever is required".to_string())?;
                ReceiveResult::ic(receive_ic_tx(token, amount, &receiver, txid).await?)
            }
            StableToken::Solana(_) => ReceiveResult::sol(receive_solana(token, args).await?),
        },
        None => {
            // ic: icrc2 approve
            let amount = args
                .amount
                .ok_or("icrc2, invalid input parameter: amount is required".to_string())?;
            let to_address = args
                .receive_addr
                .ok_or("icrc2, invalid input parameter: to_address is required".to_string())?;
            let from_address = args
                .sender_addr
                .ok_or("icrc2, invalid input parameter: from_address is required".to_string())?;
            let amount = receive_icrc2_approve(token, &amount, &from_address, &to_address).await?;
            ReceiveResult::ic(amount)
        }
    };

    Ok(res)
}

async fn receive_icrc2_approve(token: &StableToken, amount: &Nat, from_address: &Address, to_address: &Address) -> Result<Nat, String> {
    match from_address {
        Address::AccountId(_) => Err("Invalid from address type".to_string()),
        Address::PrincipalId(account) => {
            let to_address = match to_address {
                Address::AccountId(_) => return Err("Invalid acc_id dst address type".to_string()),
                Address::PrincipalId(account) => account,
                Address::SolanaAddress(_) => return Err("Invalid sol dst address type".to_string()),
            };
            icrc2_transfer_from(token, amount, account, to_address)
                .await
                .map_err(|e| e.to_string())
        }
        Address::SolanaAddress(_) => Err("TxId is required for solana receive".to_string()),
    }
}

async fn receive_ic_tx(token: &StableToken, amount: &Nat, to_address: &Address, txid: &TxId) -> Result<Nat, String> {
    let block_id = match &txid {
        TxId::BlockIndex(block_id) => block_id,
        _ => return Err("receive_ic_tx: Only block index is supported".to_string()),
    };

    verify_transfer::verify_transfer(token, to_address, block_id, amount).await
}

async fn receive_solana(token: &StableToken, args: ReceiveArgs) -> Result<SolanaVerificationResult, String> {
    let tx_id = args.txid.ok_or("TXID is required to receive solana".to_string())?;
    let signature = &args.signature.ok_or("Signature is required to receive solana".to_string())?;
    let amount = args.amount.ok_or("amount is required to receive solana".to_string())?;
    let canonical_message = &args
        .canonical_message
        .ok_or("canonical_message is required to receive solana".to_string())?;
    let sol_token = match token {
        StableToken::Solana(solana_token) => solana_token.is_spl_token,
        _ => Err("receive_solana: Invalid token type".to_string())?,
    };
    let tx_id = match &tx_id {
        TxId::BlockIndex(_) => Err("receive_solana: Invalid txid".to_string())?,
        TxId::TransactionId(v) => v,
    };

    crate::solana::verify_transfer::verify_transfer(tx_id, signature, &amount, canonical_message, token, sol_token).await
}
