use crate::ic::get_time::get_time;
use crate::ic::guards::not_in_maintenance_mode;
use crate::stable_memory::{REQUEST_ARCHIVE_MAP, REQUEST_MAP};

pub fn archive_request_map() {
    if not_in_maintenance_mode().is_err() {
        return;
    }

    /*
    // archive requests
    REQUEST_MAP.with(|request_map| {
        for (request_id, request) in request_map.borrow().iter() {
            REQUEST_ARCHIVE_MAP.with(|request_archive_map| {
                request_archive_map.borrow_mut().insert(request_id, request);
            });
        }
    });

    let one_hour_ago = get_time() - 3_600_000_000_000; // 1 hour
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
    */
}
