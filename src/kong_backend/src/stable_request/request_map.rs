use std::cmp::min;
use std::ops::Bound;

use super::reply::Reply;
use super::stable_request::{StableRequest, StableRequestId};
use super::status::{Status, StatusCode};

use crate::stable_kong_settings::kong_settings;
use crate::stable_memory::REQUEST_MAP;

const MAX_REQUESTS: usize = 20;

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

pub fn insert(request: &StableRequest) -> u64 {
    REQUEST_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let request_id = kong_settings::inc_request_map_idx();
        let insert_request = StableRequest {
            request_id,
            ..request.clone()
        };
        map.insert(StableRequestId(request_id), insert_request);
        request_id
    })
}

pub fn update_status(key: u64, status_code: StatusCode, message: Option<&str>) -> Option<StableRequest> {
    REQUEST_MAP.with(|m| {
        let mut map = m.borrow_mut();
        match map.iter().find(|(k, _)| k.0 == key) {
            Some((k, mut v)) => {
                v.statuses.push(Status {
                    status_code,
                    message: message.map(|s| s.to_string()),
                });
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
