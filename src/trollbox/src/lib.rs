// Module declarations
mod authentication;
mod types;
mod state;
mod queries;
mod updates;

// Public exports
pub use authentication::*;
pub use types::*;
pub use queries::*;
pub use updates::*;

// Initialize the canister
#[ic_cdk::init]
fn init() {
    ic_cdk::println!("Initializing trollbox canister");
}

// Candid interface generation
ic_cdk::export_candid!(); 