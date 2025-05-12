//! # Resolution Authorization
//!
//! This module handles authorization and permission checks for the
//! market resolution process.

use candid::Principal;
use crate::controllers::admin::*;
use crate::market::market::*;
use crate::resolution::resolution::ResolutionMethod;

/// Determines if a user has authorization to resolve or propose resolution for a market
///
/// This function implements the authorization logic for market resolution:
/// - Admins can always resolve any market (admin-created directly, user-created via dual approval)
/// - Market creators can propose resolutions for markets they created
/// - The resolution method specified in the market is considered
///
/// # Parameters
/// * `market` - Reference to the Market being resolved
/// * `user` - Principal ID of the user attempting to resolve the market
///
/// # Returns
/// * `bool` - True if the user is authorized to resolve/propose for this market
pub fn can_resolve_market(market: &Market, user: Principal) -> bool {
    // Is the user an admin? Admins can always propose/resolve for any market
    let is_user_admin = is_admin(user);
    
    // Is this user the creator of the market?
    let is_user_creator = market.creator == user;
    
    // For simplicity and according to existing implementation:
    // 1. Admins can always resolve any market
    // 2. The creator can propose for markets they created
    
    // Admin can always resolve any market type
    if is_user_admin {
        return true;
    }
    
    // Creator can always propose a resolution for their own market
    if is_user_creator {
        return true;
    }
    
    // Check for oracle authorization if needed
    match &market.resolution_method {
        ResolutionMethod::Oracle { oracle_principals, .. } => {
            // Check if user is authorized as an oracle for this market
            oracle_principals.contains(&user)
        },
        ResolutionMethod::Decentralized { .. } => {
            // Not implemented yet - only admins can resolve decentralized markets for now
            false
        },
        // Default case (Admin resolution): Only admins can resolve
        _ => false
    }
}
