use candid::Nat;

use super::claim_reply::ClaimReply;

use crate::helpers::nat_helpers::{nat_subtract, nat_zero};
use crate::ic::{
    address::Address::{self, AccountId, PrincipalId, SolanaAddress},
    transfer::{icp_transfer, icrc1_transfer},
};
use crate::stable_claim::claim_map;
use crate::stable_claim::stable_claim::{ClaimStatus, StableClaim};
use crate::stable_request::{reply::Reply, request_map, status::StatusCode};
use crate::stable_token::{stable_token::StableToken, token::Token};
use crate::stable_transfer::{stable_transfer::StableTransfer, transfer_map, tx_id::TxId};
use crate::transfers::transfer_reply_helpers::to_transfer_ids;

pub async fn process_claim(
    request_id: u64,
    claim: &StableClaim,
    token: &StableToken,
    amount: &Nat,
    to_address: &Address,
    ts: u64,
) -> Result<ClaimReply, String> {
    let chain = token.chain();
    let symbol = token.symbol();

    let mut transfer_ids = Vec::new();

    request_map::update_status(request_id, StatusCode::Start, None);

    let reply = match send_claim(request_id, claim, token, amount, to_address, &mut transfer_ids, ts).await {
        Ok(_) => ClaimReply {
            claim_id: claim.claim_id,
            status: "Success".to_string(),
            chain: chain.to_string(),
            symbol: symbol.to_string(),
            canister_id: token.canister_id().map(|id| id.to_text()),
            amount: amount.clone(),
            fee: token.fee(),
            to_address: to_address.to_string(),
            desc: claim.desc.as_ref().map_or_else(String::new, |desc| desc.to_string()),
            transfer_ids: to_transfer_ids(&transfer_ids),
            ts,
        },
        Err(e) => {
            let reply = ClaimReply {
                claim_id: claim.claim_id,
                status: "Failed".to_string(),
                chain: chain.to_string(),
                symbol: symbol.to_string(),
                canister_id: token.canister_id().map(|id| id.to_text()),
                amount: amount.clone(),
                fee: token.fee(),
                to_address: to_address.to_string(),
                desc: claim.desc.as_ref().map_or_else(String::new, |desc| desc.to_string()),
                transfer_ids: to_transfer_ids(&transfer_ids),
                ts,
            };
            request_map::update_reply(request_id, Reply::Claim(reply.clone()));
            return Err(e);
        }
    };

    request_map::update_reply(request_id, Reply::Claim(reply.clone()));

    Ok(reply)
}

async fn send_claim(
    request_id: u64,
    claim: &StableClaim,
    token: &StableToken,
    amount: &Nat,
    to_address: &Address,
    transfer_ids: &mut Vec<u64>,
    ts: u64,
) -> Result<(), String> {
    let claim_status = &claim.status;
    // set the claim status to claiming to prevent reentrancy before sending the claim
    claim_map::update_claiming_status(claim.claim_id);

    request_map::update_status(request_id, StatusCode::ClaimToken, None);

    match to_address {
        AccountId(to_account_id) => {
            let amount_with_gas = nat_subtract(amount, &token.fee()).unwrap_or(nat_zero());
            match icp_transfer(&amount_with_gas, to_account_id, token, None).await {
                Ok(tx_id) => {
                    let transfer_id = transfer_map::insert(&StableTransfer {
                        transfer_id: 0,
                        request_id,
                        is_send: false,
                        amount: amount_with_gas,
                        token_id: token.token_id(),
                        tx_id: TxId::BlockIndex(tx_id),
                        ts,
                    });
                    transfer_ids.push(transfer_id);
                    claim_map::update_claimed_status(claim.claim_id, request_id, transfer_id);
                    request_map::update_status(request_id, StatusCode::ClaimTokenSuccess, None);
                    Ok(())
                }
                Err(e) => {
                    // revert claim status to unclaimed or claimable
                    match claim_status {
                        ClaimStatus::Claimable => claim_map::update_claimable_status(claim.claim_id, request_id),
                        _ => claim_map::update_unclaimed_status(claim.claim_id, request_id),
                    };
                    request_map::update_status(request_id, StatusCode::ClaimTokenFailed, Some(&e));
                    Err(format!("Failed to send claim_id #{}. {}", claim.claim_id, e))
                }
            }
        }
        PrincipalId(to_principal_id) => {
            let amount_with_gas = nat_subtract(amount, &token.fee()).unwrap_or(nat_zero());
            match icrc1_transfer(&amount_with_gas, to_principal_id, token, None).await {
                Ok(tx_id) => {
                    let transfer_id = transfer_map::insert(&StableTransfer {
                        transfer_id: 0,
                        request_id,
                        is_send: false,
                        amount: amount_with_gas,
                        token_id: token.token_id(),
                        tx_id: TxId::BlockIndex(tx_id),
                        ts,
                    });
                    transfer_ids.push(transfer_id);
                    claim_map::update_claimed_status(claim.claim_id, request_id, transfer_id);
                    request_map::update_status(request_id, StatusCode::ClaimTokenSuccess, None);
                    Ok(())
                }
                Err(e) => {
                    // revert claim status to unclaimed or claimable
                    match claim_status {
                        ClaimStatus::Claimable => claim_map::update_claimable_status(claim.claim_id, request_id),
                        _ => claim_map::update_unclaimed_status(claim.claim_id, request_id),
                    };
                    request_map::update_status(request_id, StatusCode::ClaimTokenFailed, Some(&e));
                    Err(format!("Failed to send claim_id #{}. {}", claim.claim_id, e))
                }
            }
        }
        SolanaAddress(solana_address) => {
            // Create Solana swap job for failed claim
            match crate::swap::create_solana_swap_job::create_solana_swap_job(
                request_id,  // Use the claim request_id
                claim.user_id,  // Use user_id from claim
                token,
                amount,  // Use full amount for Solana
                &Address::SolanaAddress(solana_address.clone())
            ).await {
                Ok(job_id) => {
                    let transfer_id = transfer_map::insert(&StableTransfer {
                        transfer_id: 0,
                        request_id,
                        is_send: false,
                        amount: amount.clone(),
                        token_id: token.token_id(),
                        tx_id: TxId::TransactionId(format!("job_{}", job_id)),
                        ts,
                    });
                    transfer_ids.push(transfer_id);
                    claim_map::update_claimed_status(claim.claim_id, request_id, transfer_id);
                    request_map::update_status(request_id, StatusCode::ClaimTokenSuccess, 
                        Some(&format!("Solana swap job #{} created", job_id)));
                    Ok(())
                }
                Err(e) => {
                    // revert claim status to unclaimed or claimable
                    match claim_status {
                        ClaimStatus::Claimable => claim_map::update_claimable_status(claim.claim_id, request_id),
                        _ => claim_map::update_unclaimed_status(claim.claim_id, request_id),
                    };
                    let message = format!("Failed to create Solana job: {}", e);
                    request_map::update_status(request_id, StatusCode::ClaimTokenFailed, Some(&message));
                    Err(format!("Failed to send claim_id #{}. {}", claim.claim_id, message))
                }
            }
        }
    }
}
