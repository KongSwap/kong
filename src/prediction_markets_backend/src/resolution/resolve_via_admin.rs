use super::resolution_api;

use crate::types::ResolutionArgs;
use crate::resolution::resolution::ResolutionResult;

/// Resolves a market through admin decision
/// This is now a wrapper around the dual approval system
/// Note: The actual #[update] function is defined in dual_approval.rs
#[allow(dead_code)]
async fn resolve_via_admin(args: ResolutionArgs) -> ResolutionResult {
    // Use the dual approval implementation
    resolution_api::resolve_via_admin(args).await
}
