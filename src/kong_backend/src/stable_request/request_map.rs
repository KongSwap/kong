use std::cmp::Reverse;

use super::reply::Reply;
use super::stable_request::{StableRequest, StableRequestId};
use super::status::{Status, StatusCode};

use crate::kong_settings;
use crate::REQUEST_MAP;

/// get a request by request_id of the caller
pub fn get_by_request_and_user_id(request_id: u64, user_id: Option<u32>) -> Option<StableRequest> {
    REQUEST_MAP.with(|m| {
        m.borrow().iter().find_map(|(k, v)| {
            if let Some(user_id) = user_id {
                if v.user_id != user_id {
                    return None;
                }
            }
            if k.0 == request_id {
                Some(v)
            } else {
                None
            }
        })
    })
}

/// get requests by user_id
pub fn get_by_user_id(user_id: Option<u32>, max_requests: Option<usize>) -> Vec<StableRequest> {
    let mut requests: Vec<StableRequest> = REQUEST_MAP.with(|m| {
        m.borrow()
            .iter()
            .filter_map(|(_, v)| {
                if let Some(user_id) = user_id {
                    if v.user_id != user_id {
                        return None;
                    }
                }
                // no user_id specified, return all
                Some(v)
            })
            .collect()
    });
    // order by timestamp in reverse order
    requests.sort_by_key(|request| Reverse(request.ts));
    if let Some(max_requests) = max_requests {
        requests.truncate(max_requests);
    }
    requests
}

pub fn insert(request: &StableRequest) -> u64 {
    REQUEST_MAP.with(|m| {
        let mut map = m.borrow_mut();
        // increment request_id
        let request_id = kong_settings::inc_request_map_idx();
        let insert_request = StableRequest {
            request_id,
            ..request.clone()
        };
        map.insert(StableRequestId(request_id), insert_request);
        request_id
    })
}

pub fn update_status(key: u64, status_code: StatusCode, message: Option<String>) -> Option<StableRequest> {
    REQUEST_MAP.with(|m| {
        let mut map = m.borrow_mut();
        match map.iter().find(|(k, _)| k.0 == key) {
            Some((k, mut v)) => {
                v.statuses.push(Status { status_code, message });
                map.insert(k, v)
            }
            None => None,
        }
    })
}

pub fn update_reply(key: u64, reply: Reply) -> Option<StableRequest> {
    REQUEST_MAP.with(|m| {
        let mut map = m.borrow_mut();
        match map.iter().find(|(k, _)| k.0 == key) {
            Some((k, mut v)) => {
                v.reply = reply;
                map.insert(k, v)
            }
            None => None,
        }
    })
}
