pub mod finalize_market;
#[allow(clippy::module_inception)]
pub mod resolution;

// Original module - will be deprecated
pub mod dual_approval;

// New modular resolution system
pub mod resolution_auth;
pub mod resolution_refunds;
pub mod resolution_actions;
pub mod resolution_proposal;
pub mod resolution_api;

// Other resolution modules
pub mod resolve_via_admin;
pub mod resolve_via_oracle;
pub mod transfer_kong;
pub mod void_market;
