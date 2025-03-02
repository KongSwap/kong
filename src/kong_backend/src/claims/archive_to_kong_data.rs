use crate::stable_claim::claim_map;
use crate::stable_kong_settings::kong_settings_map;
use crate::stable_request::reply::Reply;
use crate::stable_request::request_map;
use crate::stable_transfer::transfer_map;

pub fn archive_to_kong_data(request_id: u64) -> Result<(), String> {
    if !kong_settings_map::get().archive_to_kong_data {
        return Ok(());
    }

    let request = request_map::get_by_request_id(request_id).ok_or(format!("Failed to archive. request_id #{} not found", request_id))?;
    request_map::archive_to_kong_data(&request)?;

    match request.reply {
        Reply::Claim(ref reply) => {
            // archive claim
            claim_map::archive_to_kong_data(reply.claim_id)?;
            // archive transfers
            reply
                .transfer_ids
                .iter()
                .try_for_each(|transfer_id_reply| transfer_map::archive_to_kong_data(transfer_id_reply.transfer_id))?;
        }
        _ => return Err("Invalid reply type".to_string()),
    }

    Ok(())
}
