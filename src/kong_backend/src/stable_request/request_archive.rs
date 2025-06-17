use crate::ic::guards::not_in_maintenance_mode;
use crate::ic::network::ICNetwork;
use crate::stable_memory::{REQUEST_ARCHIVE_MAP, REQUEST_MAP};

use super::stable_request::StableRequestId;

pub fn archive_request_map() {
    if not_in_maintenance_mode().is_err() {
        return;
    }

    // archive requests
    REQUEST_MAP.with(|request_map| {
        REQUEST_ARCHIVE_MAP.with(|request_archive_map| {
            let request = request_map.borrow();
            let mut request_archive = request_archive_map.borrow_mut();
            let start_request_id = request_archive.last_key_value().map_or(0_u64, |(k, _)| k.0);
            let end_request_id = request.last_key_value().map_or(0_u64, |(k, _)| k.0);
            for request_id in start_request_id..=end_request_id {
                if let Some(request) = request.get(&StableRequestId(request_id)) {
                    request_archive.insert(StableRequestId(request_id), request);
                }
            }
        });
    });

    // only keep requests from the last hour
    let one_hour_ago = ICNetwork::get_time() - 3_600_000_000_000;
    let mut remove_list = Vec::new();
    REQUEST_MAP.with(|request_map| {
        request_map.borrow().iter().for_each(|(request_id, request)| {
            if request.ts < one_hour_ago {
                remove_list.push(request_id);
            }
        });
    });
    REQUEST_MAP.with(|request_map| {
        remove_list.iter().for_each(|request_id| {
            request_map.borrow_mut().remove(request_id);
        });
    });
}
