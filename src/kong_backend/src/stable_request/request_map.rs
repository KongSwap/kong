use std::cmp::min;
use std::ops::Bound;

use super::reply::Reply;
use super::stable_request::{StableRequest, StableRequestId};
use super::status::{Status, StatusCode};

use crate::ic::logging::error_log;
use crate::stable_kong_settings::kong_settings_map;
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
        let request_id = kong_settings_map::inc_request_map_idx();
        let insert_request = StableRequest {
            request_id,
            ..request.clone()
        };
        map.insert(StableRequestId(request_id), insert_request.clone());
        request_id
    })
}

pub fn update_status(key: u64, status_code: StatusCode, message: Option<&str>) -> Option<StableRequest> {
    REQUEST_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let key = StableRequestId(key);
        match map.get(&key) {
            Some(mut v) => {
                v.statuses.push(Status {
                    status_code,
                    message: message.map(|s| s.to_string()),
                });
                map.insert(key, v)
            }
            None => None,
        }
    })
}

pub fn update_reply(key: u64, reply: Reply) -> Option<StableRequest> {
    REQUEST_MAP.with(|m| {
        let mut map = m.borrow_mut();
        let key = StableRequestId(key);
        match map.get(&key) {
            Some(mut v) => {
                v.reply = reply;
                map.insert(key, v)
            }
            None => None,
        }
    })
}

pub fn archive_request_to_kong_data(request_id: u64) {
    ic_cdk::spawn(async move {
        let request = match get_by_request_and_user_id(Some(request_id), None, Some(1)).pop() {
            Some(request) => request,
            None => return,
        };

        match serde_json::to_string(&request) {
            Ok(request_json) => {
                let kong_data = kong_settings_map::get().kong_data;
                match ic_cdk::call::<(String,), (Result<String, String>,)>(kong_data, "update_request", (request_json,))
                    .await
                    .map_err(|e| e.1)
                    .unwrap_or_else(|e| (Err(e),))
                    .0
                {
                    Ok(_) => (),
                    Err(e) => error_log(&format!("Failed to archive request_id #{}. {}", request.request_id, e)),
                }
            }
            Err(e) => error_log(&format!("Failed to serialize request_id #{}. {}", request.request_id, e)),
        }
    });
}
