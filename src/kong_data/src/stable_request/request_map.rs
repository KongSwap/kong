use crate::stable_request::stable_request::{StableRequest, StableRequestId};
use std::cmp::min;
use std::ops::Bound;

use crate::stable_memory::REQUEST_MAP;

const MAX_REQUESTS: usize = 100;

/// get requests filtered by user_id
pub fn get_by_request_and_user_id(start_request_id: Option<u64>, user_id: Option<u32>, num_requests: Option<usize>) -> Vec<StableRequest> {
    REQUEST_MAP.with(|m| {
        let map = m.borrow();
        let start_request_id = start_request_id.unwrap_or(map.last_key_value().map_or(0, |(k, _)| k.0));
        let num_requests = match num_requests {
            Some(num_requests) => min(num_requests, MAX_REQUESTS),
            None => 1,
        };
        map.range((Bound::Unbounded, Bound::Included(&StableRequestId(start_request_id))))
            .rev()
            .filter_map(|(_, v)| {
                if let Some(user_id) = user_id {
                    if v.user_id != user_id {
                        return None;
                    }
                }
                Some(v)
            })
            .take(num_requests)
            .collect()
    })
}
