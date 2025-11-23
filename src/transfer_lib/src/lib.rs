pub mod canister;
pub mod get_address;
pub mod memory_manager;
pub mod receive;
pub mod send;
pub mod solana;
pub mod stable_memory;
pub mod stable_transfer_settings;
pub mod transfer_map;
mod verify_transfer;

pub const LIB_NAME: &str = "Transfer Lib";
pub const LIB_VERSION: &str = "v0.1.0";
