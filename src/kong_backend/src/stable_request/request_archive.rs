use crate::canister::guards::not_in_maintenance_mode;
use crate::{REQUEST_ARCHIVE_MAP, REQUEST_MAP};

pub fn archive_request_map() {
    if not_in_maintenance_mode().is_err() {
        return;
    }

    // archive requests
    REQUEST_MAP.with(|request_map| {
        for (request_id, request) in request_map.borrow().iter() {
            REQUEST_ARCHIVE_MAP.with(|request_map_tmp| {
                request_map_tmp.borrow_mut().insert(request_id, request);
            });
        }
    });

    // remove requests older than 1 hour
    let one_hour_ago = ic_cdk::api::time() - 60 * 60_000_000_000;
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
