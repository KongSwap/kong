//! Prediction Markets Backend Integration Tests
//! 
//! This is the main entry point for all integration tests.
//! It imports and exposes all the test modules for the different components
//! of the prediction markets backend.

// First, import the common test utilities
mod common;

// Import all the component-specific test modules
mod admin;
mod claims;  // New claims module for testing user-assisted claims system
mod market;
mod resolution;
mod token;

// Re-export test modules to make them discoverable
pub use admin::*;
pub use claims::*;  // Export claims tests
pub use market::*;
pub use token::*;

// Add any integration tests that span multiple modules here
#[test]
fn test_sanity_check() {
    // A simple sanity check to verify that the test harness is working
    assert!(true, "Test harness is working");
    println!("Integration test framework initialized successfully");
}
