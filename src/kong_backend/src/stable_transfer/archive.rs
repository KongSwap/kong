use crate::ic::logging::error_log;
use crate::stable_kong_settings::kong_settings_map;
use transfer_lib::transfer_map;

pub fn archive_to_kong_data(transfer_id: u64) -> Result<(), String> {
    if !kong_settings_map::get().archive_to_kong_data {
        return Ok(());
    }

    let transfer = match transfer_map::get_by_transfer_id(transfer_id) {
        Some(transfer) => transfer,
        None => return Err(format!("Failed to archive. transfer_id #{} not found", transfer_id)),
    };
    let transfer_json = match serde_json::to_string(&transfer) {
        Ok(transfer_json) => transfer_json,
        Err(e) => return Err(format!("Failed to archive transfer_id #{}. {}", transfer_id, e)),
    };

    ic_cdk::futures::spawn(async move {
        let kong_data = kong_settings_map::get().kong_data;
        match ic_cdk::call::Call::unbounded_wait(kong_data, "update_transfer")
            .with_arg(transfer_json)
            .await
            .map_err(|e| format!("{:?}", e))
            .and_then(|response| response.candid::<Result<String, String>>().map_err(|e| format!("{:?}", e)))
        {
            Ok(_) => (),
            Err(e) => error_log(&format!("Failed to archive transfer_id #{}. {}", transfer.transfer_id, e)),
        }
    });

    Ok(())
}
