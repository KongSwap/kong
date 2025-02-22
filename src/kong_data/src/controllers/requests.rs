use ic_cdk::{query, update};
use std::collections::BTreeMap;

use crate::ic::get_time::get_time;
use crate::ic::guards::{caller_is_kingkong, caller_is_kong_backend};
use crate::stable_db_update::db_update_map;
use crate::stable_db_update::stable_db_update::{StableDBUpdate, StableMemory};
use crate::stable_memory::REQUEST_MAP;
use crate::stable_request::stable_request::{StableRequest, StableRequestId};

const MAX_REQUESTS: usize = 100;

#[query(hidden = true, guard = "caller_is_kingkong")]
fn max_request_idx() -> u64 {
    REQUEST_MAP.with(|m| m.borrow().last_key_value().map_or(0, |(k, _)| k.0))
}

#[query(hidden = true, guard = "caller_is_kingkong")]
fn backup_requests(request_id: Option<u64>, num_requests: Option<u16>) -> Result<String, String> {
    REQUEST_MAP.with(|m| {
        let map = m.borrow();
        let requests: BTreeMap<_, _> = match request_id {
            Some(request_id) => {
                let num_requests = num_requests.map_or(1, |n| n as usize);
                let start_key = StableRequestId(request_id);
                map.range(start_key..).take(num_requests).collect()
            }
            None => {
                let num_requests = num_requests.map_or(MAX_REQUESTS, |n| n as usize);
                map.iter().take(num_requests).collect()
            }
        };
        serde_json::to_string(&requests).map_err(|e| format!("Failed to serialize requests: {}", e))
    })
}

/// deserialize REQUEST_MAP and update stable memory
#[update(hidden = true, guard = "caller_is_kingkong")]
fn update_requests(stable_requests_json: String) -> Result<String, String> {
    let requests: BTreeMap<StableRequestId, StableRequest> = match serde_json::from_str(&stable_requests_json) {
        Ok(requests) => requests,
        Err(e) => return Err(format!("Invalid requests: {}", e)),
    };

    REQUEST_MAP.with(|request_map| {
        let mut map = request_map.borrow_mut();
        for (k, v) in requests {
            map.insert(k, v);
        }
    });

    Ok("Requests updated".to_string())
}

#[update(hidden = true, guard = "caller_is_kong_backend")]
fn update_request(stable_request_json: String) -> Result<String, String> {
    let request: StableRequest = match serde_json::from_str(&stable_request_json) {
        Ok(request) => request,
        Err(e) => return Err(format!("Invalid request: {}", e)),
    };

    REQUEST_MAP.with(|request_map| {
        let mut map = request_map.borrow_mut();
        map.insert(StableRequestId(request.request_id), request.clone());
    });

    // add to UpdateMap for archiving to database
    let ts = get_time();
    let update = StableDBUpdate {
        db_update_id: 0,
        stable_memory: StableMemory::RequestMap(request),
        ts,
    };
    db_update_map::insert(&update);

    Ok("Request updated".to_string())
}
