use icrc_ledger_types::icrc21::requests::ConsentMessageRequest;
use icrc_ledger_types::icrc21::responses::ConsentInfo;
use icrc_ledger_types::icrc21::errors::ErrorInfo;

// Module declarations
mod authentication;
mod types;
mod state;
mod queries;
mod updates;
mod admin;

// Public exports
pub use authentication::*;
pub use types::*;
pub use queries::*;
pub use updates::*;
pub use admin::*;

// Initialize the canister
#[ic_cdk::init]
fn init() {
    ic_cdk::println!("Initializing trollbox canister");
    
    // Initialize the canister deployer as the first admin
    admin::init_admin();
}

// Candid interface generation
ic_cdk::export_candid!(); 