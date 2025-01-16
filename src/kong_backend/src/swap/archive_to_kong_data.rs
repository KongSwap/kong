use crate::stable_claim::claim_map;
use crate::stable_kong_settings::kong_settings_map;
use crate::stable_request::reply::Reply;
use crate::stable_request::request_map;
use crate::stable_transfer::transfer_map;
use crate::stable_tx::tx_map;

pub fn archive_to_kong_data(request_id: u64) -> Result<(), String> {
    if !kong_settings_map::get().archive_to_kong_data {
        return Ok(());
    }

    if let Some(request) = request_map::get_by_request_id(request_id) {
        if let Reply::Swap(ref reply) = request.reply {
            // archive request
            request_map::archive_to_kong_data(&request)?;
            // archive claims
            reply
                .claim_ids
                .iter()
                .try_for_each(|&claim_id| claim_map::archive_to_kong_data(claim_id))?;
            // archive transfers
            reply
                .transfer_ids
                .iter()
                .try_for_each(|transfer_id_reply| transfer_map::archive_to_kong_data(transfer_id_reply.transfer_id))?;
            // archive txs
            tx_map::archive_to_kong_data(reply.tx_id)?;
        } else {
            return Err("Invalid reply type".to_string());
        }
    } else {
        return Err(format!("Failed to archive. request_id #{} not found", request_id));
    }

    Ok(())
}
