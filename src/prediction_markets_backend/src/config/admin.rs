use candid::Principal;
use ic_stable_structures::Storable;
use std::collections::HashSet;
use std::borrow::Cow;
use ic_cdk::{caller, query, update};
use serde::{Serialize, Deserialize};
use std::cell::RefCell;

const DEFAULT_ADMIN_PRINCIPALS: [&str; 5] = [
    "4jxje-hbmra-4otqc-6hor3-cpwlh-sqymk-6h4ef-42sqn-o3ip5-s3mxk-uae",
    "6rjil-isfbu-gsmpe-ffvcl-v3ifl-xqgkr-en2ir-pbr54-cetku-syp4i-bae",
    // Shill principals below
    "7ohni-sbpse-y327l-syhzk-jn6n4-hw277-erei5-xhkjr-lbh6b-rjqei-sqe",
    "6ydau-gqejl-yqbq7-tm2i5-wscbd-lsaxy-oaetm-dxddd-s5rtd-yrpq2-eae",
    "bc4tr-kdoww-zstxb-plqge-bo6ho-abuc2-mft22-6tdpb-5ofll-yknor-sae",
];

thread_local! {
    static ADMIN_PRINCIPALS: RefCell<HashSet<Principal>> = RefCell::new({
        let mut admins = HashSet::new();
        // Add initial admin (canister owner/deployer)
        admins.insert(ic_cdk::api::id());
        
        // Add default admin principals
        for principal_str in DEFAULT_ADMIN_PRINCIPALS.iter() {
            if let Ok(principal) = Principal::from_text(principal_str) {
                admins.insert(principal);
            }
        }
        admins
    });
}

#[derive(Debug, Serialize, Deserialize, Clone, candid::CandidType)]
pub struct AdminInfo {
    pub principal_id: Principal,
}

impl Storable for AdminInfo {
    fn to_bytes(&self) -> Cow<[u8]> {
        let encoded = candid::encode_one(self).unwrap();
        Cow::Owned(encoded)
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        candid::decode_one(&bytes).unwrap()
    }

    const BOUND: ic_stable_structures::storable::Bound = ic_stable_structures::storable::Bound::Unbounded;
}

/// Checks if a principal is an admin
#[query]
pub fn is_admin(principal: Principal) -> bool {
    ADMIN_PRINCIPALS.with(|admins| {
        admins.borrow().contains(&principal)
    })
}

/// Returns list of all admin principals
#[query]
pub fn get_admin_principals() -> Vec<Principal> {
    ADMIN_PRINCIPALS.with(|admins| {
        admins.borrow().iter().cloned().collect()
    })
}

/// Add a new admin (only callable by existing admin)
#[update]
pub fn add_admin(new_admin: Principal) -> Result<(), String> {
    let caller = caller();
    if !is_admin(caller) {
        return Err("Only existing admins can add new admins".to_string());
    }

    ADMIN_PRINCIPALS.with(|admins| {
        admins.borrow_mut().insert(new_admin);
    });
    Ok(())
}

/// Remove an admin (only callable by existing admin)
#[update]
pub fn remove_admin(admin_to_remove: Principal) -> Result<(), String> {
    let caller = caller();
    if !is_admin(caller) {
        return Err("Only existing admins can remove admins".to_string());
    }

    // Prevent removing the last admin
    ADMIN_PRINCIPALS.with(|admins| {
        let mut admins = admins.borrow_mut();
        if admins.len() <= 1 {
            return Err("Cannot remove the last admin".to_string());
        }
        if !admins.remove(&admin_to_remove) {
            return Err("Admin not found".to_string());
        }
        Ok(())
    })
}

/// Pre-upgrade hook to save admin state
pub fn pre_upgrade() {
    // Save admin state to stable storage if needed
}

/// Post-upgrade hook to restore admin state
pub fn post_upgrade() {
    // Restore admin state from stable storage if needed
}
