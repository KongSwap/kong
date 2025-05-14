//! # Administrative Controllers Module
//! 
//! This module implements administrative functionality for the Kong Swap prediction markets,
//! including admin authentication, authorization checks, and core administrative operations.
//!
//! ## Key Features
//! - Admin principal management and authentication
//! - Administrative access control for system functions
//! - Fee collection account management
//!
//! ## Security Model
//! The module uses a predefined list of administrator principals that have elevated
//! permissions within the system. These permissions include:
//! - Creating admin-controlled markets
//! - Directly resolving admin-created markets without dual approval
//! - Reviewing and confirming user-created market resolutions
//! - Managing system configurations and parameters
//! - Handling fee collection and distribution

use candid::Principal;
use std::cell::RefCell;
use std::collections::HashSet;
use ic_cdk::query;

/// Default administrator principal IDs with elevated system permissions
/// 
/// These principals have special privileges in the system including:
/// - Creating admin-controlled markets
/// - Direct market resolution (bypassing dual approval for admin-created markets)
/// - Reviewing user-proposed market resolutions
/// - System configuration and management
/// 
/// The list includes both production administrators and development team members.
const DEFAULT_ADMIN_PRINCIPALS: [&str; 6] = [
    "4jxje-hbmra-4otqc-6hor3-cpwlh-sqymk-6h4ef-42sqn-o3ip5-s3mxk-uae",
    "6rjil-isfbu-gsmpe-ffvcl-v3ifl-xqgkr-en2ir-pbr54-cetku-syp4i-bae",
    "hkxzv-wmenl-q4d3b-j3o5s-yucpn-g5itu-b3zmq-hxggl-s3atg-vryjf-dqe",
    // Shill principals below
    "7ohni-sbpse-y327l-syhzk-jn6n4-hw277-erei5-xhkjr-lbh6b-rjqei-sqe",
    "fmlck-tlm2l-l33tz-qspuz-4omct-54vzm-5ciga-ru3ge-awtjs-jezfa-yqe",
    // Aaron
    "m6wjp-mi46v-ekfrp-lu3wo-ero7s-e2y57-yu4kv-235o5-bnmti-qjpgk-aqe"
];

// Administrator principals registry maintained in thread-local storage
thread_local! {
    /// Thread-local storage for the set of administrator principals
    /// 
    /// This thread-local provides efficient access to the set of administrator principals
    /// that are authorized to perform privileged operations. It includes:
    /// - The canister's own principal ID (for self-calls)
    /// - All principals defined in DEFAULT_ADMIN_PRINCIPALS
    /// 
    /// The use of thread_local storage ensures consistent access across async calls
    /// and maintains the integrity of the administrator list during system operation.
    static ADMIN_PRINCIPALS: RefCell<HashSet<Principal>> = RefCell::new({
        let mut admins = HashSet::new();
        // Add canister_id as admin (for self-calls)
        admins.insert(ic_cdk::api::id());
        // Add admin principal ids as admin
        for principal in DEFAULT_ADMIN_PRINCIPALS.iter() {
            if let Ok(principal) = Principal::from_text(principal) {
                admins.insert(principal);
            }
        }
        admins
    });
}

/// Checks if a principal has administrator privileges
/// 
/// This function verifies whether a given principal is authorized to perform
/// administrative actions in the system. It's used throughout the codebase
/// to enforce access control on privileged operations.
/// 
/// In the dual approval resolution system, admins have special privileges:
/// - For admin-created markets: Admins can directly resolve without proposals
/// - For user-created markets: Admins review and confirm creator proposals
/// 
/// # Parameters
/// * `principal` - The Principal ID to check for admin rights
/// 
/// # Returns
/// * `true` if the principal is an administrator
/// * `false` otherwise
#[query]
pub fn is_admin(principal: Principal) -> bool {
    ADMIN_PRINCIPALS.with(|admins| admins.borrow().contains(&principal))
}

/// Retrieves the minter account principal used for fee collection
/// 
/// This function determines the appropriate principal to use for fee collection
/// based on the current environment (production or development). The minter account
/// serves several purposes in the system:
/// 
/// 1. Collecting platform fees from market operations (except for KONG tokens)
/// 2. Serving as the destination for fee transfers in multi-token markets
/// 3. Acting as the treasury account for administrative fee withdrawals
/// 
/// For KONG tokens specifically, fees are typically burned rather than collected.
/// 
/// # Environment-Aware Selection
/// - In production: Uses the production minter principal
/// - In development/testing: Uses the local testing minter principal
/// - Fallback chain: minter → first admin → canister ID
/// 
/// # Returns
/// The Principal ID to use for fee collection operations
pub fn get_minter_account_from_storage() -> Principal {
    // Use the same minter address for all tokens as defined in transfer_kong.rs
    let minter_address = if crate::KONG_LEDGER_ID == "o7oak-iyaaa-aaaaq-aadzq-cai" {
        // Production environment
        crate::resolution::transfer_kong::KONG_MINTER_PRINCIPAL_PROD
    } else {
        // Local or test environment
        crate::resolution::transfer_kong::KONG_MINTER_PRINCIPAL_LOCAL
    };
    
    if let Ok(minter) = Principal::from_text(minter_address) {
        return minter;
    }
    
    // Fallback to the first admin principal if conversion fails
    if let Ok(admin) = Principal::from_text(DEFAULT_ADMIN_PRINCIPALS[0]) {
        return admin;
    }
    
    // Final fallback to canister ID
    ic_cdk::api::id()
}
