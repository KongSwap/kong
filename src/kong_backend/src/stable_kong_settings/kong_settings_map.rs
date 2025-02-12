use std::cmp;

use crate::stable_memory::KONG_SETTINGS;

use super::stable_kong_settings::StableKongSettings;

const LAST_SYSTEM_USER_ID: u32 = 99;

pub fn get() -> StableKongSettings {
    KONG_SETTINGS.with(|s| s.borrow().get().clone())
}

pub fn inc_user_map_idx() -> u32 {
    KONG_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        let kong_settings = map.get();
        let user_map_idx = cmp::max(LAST_SYSTEM_USER_ID, kong_settings.user_map_idx) + 1;
        let new_kong_settings = StableKongSettings {
            user_map_idx,
            ..kong_settings.clone()
        };
        _ = map.set(new_kong_settings);
        user_map_idx
    })
}

pub fn inc_token_map_idx() -> u32 {
    KONG_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        let kong_settings = map.get();
        let token_map_idx = kong_settings.token_map_idx + 1;
        let new_kong_settings = StableKongSettings {
            token_map_idx,
            ..kong_settings.clone()
        };
        _ = map.set(new_kong_settings);
        token_map_idx
    })
}

pub fn inc_pool_map_idx() -> u32 {
    KONG_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        let kong_settings = map.get();
        let pool_map_idx = kong_settings.pool_map_idx + 1;
        let new_kong_settings = StableKongSettings {
            pool_map_idx,
            ..kong_settings.clone()
        };
        _ = map.set(new_kong_settings);
        pool_map_idx
    })
}

pub fn inc_tx_map_idx() -> u64 {
    KONG_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        let kong_settings = map.get();
        let tx_map_idx = kong_settings.tx_map_idx + 1;
        let new_kong_settings = StableKongSettings {
            tx_map_idx,
            ..kong_settings.clone()
        };
        _ = map.set(new_kong_settings);
        tx_map_idx
    })
}

pub fn inc_request_map_idx() -> u64 {
    KONG_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        let kong_settings = map.get();
        let request_map_idx = kong_settings.request_map_idx + 1;
        let new_kong_settings = StableKongSettings {
            request_map_idx,
            ..kong_settings.clone()
        };
        _ = map.set(new_kong_settings);
        request_map_idx
    })
}

pub fn inc_transfer_map_idx() -> u64 {
    KONG_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        let kong_settings = map.get();
        let transfer_map_idx = kong_settings.transfer_map_idx + 1;
        let new_kong_settings = StableKongSettings {
            transfer_map_idx,
            ..kong_settings.clone()
        };
        _ = map.set(new_kong_settings);
        transfer_map_idx
    })
}

pub fn inc_claim_map_idx() -> u64 {
    KONG_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        let kong_settings = map.get();
        let claim_map_idx = kong_settings.claim_map_idx + 1;
        let new_kong_settings = StableKongSettings {
            claim_map_idx,
            ..kong_settings.clone()
        };
        _ = map.set(new_kong_settings);
        claim_map_idx
    })
}

pub fn inc_lp_token_map_idx() -> u64 {
    KONG_SETTINGS.with(|s| {
        let mut map = s.borrow_mut();
        let kong_settings = map.get();
        let lp_token_map_idx = kong_settings.lp_token_map_idx + 1;
        let new_kong_settings = StableKongSettings {
            lp_token_map_idx,
            ..kong_settings.clone()
        };
        _ = map.set(new_kong_settings);
        lp_token_map_idx
    })
}
