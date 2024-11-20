use kong_lib::stable_request::stable_request::{StableRequest, StableRequestId};

use crate::stable_memory::REQUEST_MAP;

/// get a request by request_id of the caller
pub fn get_by_request_and_user_id(request_id: u64, user_id: Option<u32>) -> Option<StableRequest> {
    REQUEST_MAP.with(|m| {
        m.borrow().get(&StableRequestId(request_id)).and_then(|v| {
            if let Some(user_id) = user_id {
                if v.user_id != user_id {
                    return None;
                }
            }
            Some(v)
        })
    })
}

/// get requests filtered by user_id
pub fn get_by_user_id(user_id: Option<u32>, num_requests: usize) -> Vec<StableRequest> {
    REQUEST_MAP.with(|m| {
        m.borrow()
            .iter()
            .rev()
            .filter_map(|(_, v)| {
                if let Some(user_id) = user_id {
                    if v.user_id != user_id {
                        return None;
                    }
                }
                Some(v.clone())
            })
            .take(num_requests)
            .collect()
    })
}
