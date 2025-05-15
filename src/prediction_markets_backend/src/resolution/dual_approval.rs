//! # Dual Approval Resolution System
//! 
//! This module implements the market resolution system for Kong Swap prediction markets.
//! It supports two distinct resolution flows based on the market creator type:
//! 
//! 1. **Admin-Created Markets**: Can be resolved directly by any admin without requiring
//!    dual approval. When an admin resolves an admin-created market, the resolution is immediate.
//! 
//! 2. **User-Created Markets**: Require dual approval between the creator and an admin.
//!    The creator proposes a resolution first, then an admin must confirm with the same
//!    resolution. If there's a disagreement (admin proposes different outcomes), the market
//!    is voided and the creator's deposit is burned.
//!
//! This implementation ensures proper governance while maintaining efficiency for
//! admin-operated markets.
//!
//! ## DEPRECATION NOTICE
//! 
//! This module is being refactored into smaller, more focused modules:
//! - `resolution_auth`: Authorization and permissions
//! - `resolution_refunds`: Refund processing
//! - `resolution_actions`: Core resolution actions
//! - `resolution_proposal`: Proposal creation and handling
//! - `resolution_api`: Public API endpoints
//!
//! Please use those modules directly for new code. This module remains
//! for backward compatibility but will be removed in a future release.

use candid::{Principal, Nat};
use ic_cdk::update;

use crate::types::{MarketId, OutcomeIndex, ResolutionArgs};
use crate::market::market::Market;
use crate::resolution::resolution::ResolutionError;

/// Refunds all bets when a market is voided
///
/// This function processes refunds for all bets placed on a voided market.
/// For each bet, it transfers the original bet amount (minus transfer fee)
/// back to the user who placed the bet. Failed transfers are logged but don't
/// stop the process - this ensures all users have an opportunity to receive
/// their refunds.
///
/// # Parameters
/// * `market_id` - ID of the market being voided
/// * `market` - Reference to the Market that is being voided
///
/// # Returns
/// * `Result<(), ResolutionError>` - Success indicator or error reason if the process fails
///
/// # Deprecation
/// This function is deprecated. Use `resolution_refunds::refund_all_bets` instead.
#[deprecated(since = "1.1.0", note = "Use resolution_refunds::refund_all_bets instead")]
pub async fn refund_all_bets(
    market_id: MarketId,
    market: &Market
) -> Result<(), ResolutionError> {
    // Re-export from the new modular structure
    crate::resolution::resolution_refunds::refund_all_bets(&market_id, market).await
}

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
/// 
/// # Deprecation
/// This function is deprecated. Use `resolution_auth::can_resolve_market` instead.
#[deprecated(since = "1.1.0", note = "Use resolution_auth::can_resolve_market instead")]
pub fn can_resolve_market(market: &Market, user: Principal) -> bool {
    // Re-export from the new modular structure
    crate::resolution::resolution_auth::can_resolve_market(market, user)
}

/// Proposes or executes a resolution for a market
/// 
/// This function implements the dual resolution system with two distinct resolution flows:
/// 
/// 1. **Admin-Created Markets**: Immediate resolution when any admin proposes, without
///    requiring dual approval.
/// 
/// 2. **User-Created Markets**: Requires dual approval between the creator and an admin.
///    - When a creator proposes first, it's recorded as a proposal waiting for admin confirmation
///    - When an admin proposes first, it's recorded as a proposal waiting for creator confirmation
///    - When the second party proposes matching outcomes, the market is finalized
/// 
/// # Parameters
/// * `market_id` - ID of the market to resolve
/// * `winning_outcomes` - Vector of outcome indices that won (multiple allowed for multi-select markets)
/// 
/// # Returns
/// * `Result<(), ResolutionError>` - Success or failure with error reason
/// 
/// # Security
/// Only market creators and admins can call this function. For admin-created markets,
/// only admins can resolve. For user-created markets, both the creator and an admin
/// must agree on the outcome.
/// 
/// # Deprecation
/// This function is deprecated. Use `resolution_api::propose_resolution` instead.
#[update]
#[deprecated(since = "1.1.0", note = "Use resolution_api::propose_resolution instead")]
pub async fn propose_resolution(
    args: ResolutionArgs
) -> Result<(), ResolutionError> {
    // Re-export from the new modular structure
    crate::resolution::resolution_proposal::propose_resolution(args).await
}

/// Allows an admin to force resolve a market, bypassing the dual-approval process
/// 
/// This function provides a way for admins to resolve markets directly in special cases
/// where the normal dual approval process cannot be completed. It should be used with care
/// as it overrides the governance mechanisms.
/// 
/// # Parameters
/// * `market_id` - ID of the market to force resolve
/// * `winning_outcomes` - Vector of outcome indices that won
/// 
/// # Returns
/// * `Result<(), ResolutionError>` - Success or error reason if the resolution fails
/// 
/// # Security
/// Only admins can call this function.
/// 
/// # Deprecation
/// This function is deprecated. Use `resolution_actions::force_resolve_market` instead.
#[update]
#[deprecated(since = "1.1.0", note = "Use resolution_actions::force_resolve_market instead")]
pub async fn force_resolve_market(
    args: ResolutionArgs
) -> Result<(), ResolutionError> {
    // Re-export from the new modular structure
    crate::resolution::resolution_actions::force_resolve_market(args).await
}

/// Resolve the market through admin decision
/// 
/// This is a public API endpoint that aliases to the propose_resolution function, maintaining
/// backward compatibility while ensuring the dual approval system is followed.
/// 
/// For admin-created markets: immediate resolution by any admin
/// For user-created markets: requires dual approval between creator and admin
/// 
/// # Parameters
/// * `args` - Struct containing market ID and winning outcomes
/// 
/// # Returns
/// * `Result<(), ResolutionError>` - Success or error reason if the resolution fails
/// 
/// # Security
/// Only market creators and admins can call this function successfully.
/// 
/// # Deprecation
/// This function is deprecated. Use `resolution_api::resolve_via_admin` instead.
#[update]
#[deprecated(since = "1.1.0", note = "Use resolution_api::resolve_via_admin instead")]
pub async fn resolve_via_admin(
    args: ResolutionArgs
) -> Result<(), ResolutionError> {
    // Re-export from the new modular structure
    crate::resolution::resolution_api::resolve_via_admin(args).await
}

/// For backward compatibility
#[update]
#[deprecated(since = "1.1.0", note = "Use resolution_api::resolve_via_admin instead")]
pub async fn resolve_via_admin_legacy(
    market_id: MarketId, 
    winning_outcomes: Vec<OutcomeIndex>
) -> Result<(), ResolutionError> {
    // Convert to new type and forward
    resolve_via_admin(ResolutionArgs {
        market_id,
        winning_outcomes,
    }).await
}

/// Voids a market and refunds all bets to users
/// 
/// This function allows admins to void a market (due to ambiguous resolution,
/// technical issues, or other reasons) and ensure all users receive refunds of
/// their original bets. Unlike the disagreement handler, this does not burn
/// the creator's deposit.
/// 
/// # Parameters
/// * `market_id` - ID of the market to void
/// 
/// # Returns
/// * `Result<(), ResolutionError>` - Success or error reason if the process fails
/// 
/// # Security
/// Only admins can call this function.
/// 
/// # Deprecation
/// This function is deprecated. Use `resolution_actions::void_market` instead.
#[update]
#[deprecated(since = "1.1.0", note = "Use resolution_actions::void_market instead")]
pub async fn void_market(
    market_id: MarketId
) -> Result<(), ResolutionError> {
    // Re-export from the new modular structure
    crate::resolution::resolution_actions::void_market(market_id).await
}
