use crate::stable_claim::claim_map;
use crate::{stable_claim::stable_claim::StableClaim, stable_token::token_map};
use kong_lib::chains::chains::SOL_CHAIN;
use kong_lib::ic::address::Address;
use kong_lib::ic::logging;
use kong_lib::ic::network::ICNetwork;
use kong_lib::stable_token::token::Token;
use transfer_lib::solana::swap_job::SwapJob;

fn add_swap_callback_impl(job: SwapJob, _final_solana_tx_sig: String, error_msg: Option<String>) -> Result<(), String> {
    let was_successful = error_msg.is_none();

    let symbol = token_map::get_by_token(&job.symbol)?;
    if symbol.chain() != SOL_CHAIN {
        return Err(format!("Expected {} chain, got={}", SOL_CHAIN, symbol.chain()));
    }

    if !was_successful {
        let claim = StableClaim::new(
            job.user_id,
            symbol.token_id(),
            &job.amount,
            Some(job.request_id),
            Some(Address::SolanaAddress(job.dst_address)),
            ICNetwork::get_time(),
        );

        let claim_id = claim_map::insert(&claim);
        logging::info_log(&format!("Created claim #{} for failed swap job #{}", claim_id, job.id));
    }

    Ok(())
}

pub fn add_swap_callback(job: SwapJob, final_solana_tx_sig: String, error_msg: Option<String>) {
    let _ = add_swap_callback_impl(job, final_solana_tx_sig, error_msg);
}
