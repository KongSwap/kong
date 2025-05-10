# Kong Solana Port Guide

This guide details how to port the Solana integration from kong_solana to kong_backend.

## 1. Create Directory Structure

Create the following directories:

```bash
mkdir -p /Users/caner/kong-8/src/kong_backend/src/sol
mkdir -p /Users/caner/kong-8/src/kong_backend/src/sol/rpc
mkdir -p /Users/caner/kong-8/src/kong_backend/src/sol/sdk
```

## 2. Copy Core Files

### 2.1 Update lib.rs

Add `pub mod sol;` to `/Users/caner/kong-8/src/kong_backend/src/lib.rs`

### 2.2 Copy Error Definitions

Copy `/Users/caner/kong-8/kong_solana/src/kong_solana_backend/src/solana/error.rs` to `/Users/caner/kong-8/src/kong_backend/src/sol/error.rs`

Replace all instances of `solana::error` to `sol::error` in the copied file.

### 2.3 Copy Network Module

Copy `/Users/caner/kong-8/kong_solana/src/kong_solana_backend/src/solana/network.rs` to `/Users/caner/kong-8/src/kong_backend/src/sol/network.rs`

Update imports to reflect the new directory structure. Replace:
- `use crate::solana::error::SolanaError;` with `use crate::sol::error::SolanaError;`
- `use crate::ic::network::ICNetwork;` with the correct ICNetwork import

### 2.4 Copy SDK Files

Copy the following files from the kong_solana SDK directory to kong_backend:

- `/Users/caner/kong-8/kong_solana/src/kong_solana_backend/src/solana/sdk/mod.rs` → `/Users/caner/kong-8/src/kong_backend/src/sol/sdk/mod.rs`
- `/Users/caner/kong-8/kong_solana/src/kong_solana_backend/src/solana/sdk/pubkey.rs` → `/Users/caner/kong-8/src/kong_backend/src/sol/sdk/pubkey.rs`
- `/Users/caner/kong-8/kong_solana/src/kong_solana_backend/src/solana/sdk/signature.rs` → `/Users/caner/kong-8/src/kong_backend/src/sol/sdk/signature.rs`
- `/Users/caner/kong-8/kong_solana/src/kong_solana_backend/src/solana/sdk/offchain_message.rs` → `/Users/caner/kong-8/src/kong_backend/src/sol/sdk/offchain_message.rs`

Update all imports in these files to reflect the new directory structure.

### 2.5 Copy RPC Client

Copy `/Users/caner/kong-8/kong_solana/src/kong_solana_backend/src/solana/rpc/client.rs` to `/Users/caner/kong-8/src/kong_backend/src/sol/rpc/client.rs`

Update imports to reflect the new directory structure.

### 2.6 Copy Transaction Verification

Copy `/Users/caner/kong-8/kong_solana/src/kong_solana_backend/src/solana/rpc/get_transaction.rs` to `/Users/caner/kong-8/src/kong_backend/src/sol/rpc/get_transaction.rs`

Update imports to reflect the new directory structure.

### 2.7 Copy Schnorr Functions from IC Module

Copy `/Users/caner/kong-8/kong_solana/src/kong_solana_backend/src/ic/schnorr.rs` to `/Users/caner/kong-8/src/kong_backend/src/ic/schnorr.rs`

Update imports to reflect the kong_backend directory structure.

### 2.8 Copy Transaction Verification

Copy `/Users/caner/kong-8/kong_solana/src/kong_solana_backend/src/solana/verify_transaction.rs` to `/Users/caner/kong-8/src/kong_backend/src/sol/verify_transaction.rs`

Update imports to reflect the new directory structure.

## 3. Create Basic Module Files

### 3.1 Create sol/mod.rs

Create `/Users/caner/kong-8/src/kong_backend/src/sol/mod.rs` with:

```rust
pub mod error;
pub mod network;
pub mod rpc;
pub mod sdk;
pub mod verify_transaction;
```

### 3.2 Create sol/rpc/mod.rs

Create `/Users/caner/kong-8/src/kong_backend/src/sol/rpc/mod.rs` with:

```rust
pub mod client;
pub mod get_transaction;

pub use client::SolanaRpcClient;
```

## 4. Add SOL Token Structure

### 4.1 Create SOL Token Module

Create directory:
```bash
mkdir -p /Users/caner/kong-8/src/kong_backend/src/stable_token/sol_token
```

Create `/Users/caner/kong-8/src/kong_backend/src/stable_token/sol_token/mod.rs` with:

```rust
use crate::stable_token::token::Token;
use crate::chains::chains::SOL_CHAIN;
use ic_cdk::api::management_canister::ecdsa::EcdsaKeyId;
use candid::{CandidType, Deserialize};
use serde::Serialize;

/// Solana Token representation for Kong DEX
#[derive(Clone, Debug, CandidType, Deserialize, Serialize)]
pub struct SOLToken {
    pub token_id: u32,
    pub name: String,
    pub symbol: String,
    pub decimals: u8,
    pub logo: String,
    pub fee: u64,
    pub min_amount: u64,
    pub address: String,  // Solana token program address (for SPL tokens) or empty for native SOL
    pub is_removed: bool,
}

impl SOLToken {
    /// Create a new SOL token
    pub fn new(
        token_id: u32,
        name: String,
        symbol: String,
        decimals: u8,
        logo: String,
        fee: u64,
        min_amount: u64,
        address: String,
        is_removed: bool,
    ) -> Self {
        Self {
            token_id,
            name,
            symbol,
            decimals,
            logo,
            fee,
            min_amount,
            address,
            is_removed,
        }
    }

    /// Check if this is native SOL
    pub fn is_native(&self) -> bool {
        self.address.is_empty()
    }
    
    /// Get chain string
    pub fn chain(&self) -> String {
        SOL_CHAIN.to_string()
    }
}
```

### 4.2 Update StableToken Enum

Update `/Users/caner/kong-8/src/kong_backend/src/stable_token/stable_token.rs` to add SOL variant:

```rust
use super::sol_token::SOLToken;

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub enum StableToken {
    LP(LPToken), // LP tokens
    IC(ICToken), // IC tokens
    SOL(SOLToken), // Solana tokens
}
```

### 4.3 Update Token Trait Implementation

Update `/Users/caner/kong-8/src/kong_backend/src/stable_token/token.rs` to add SOL match arms to each method.

### 4.4 Update stable_token/mod.rs

Add `pub mod sol_token;` to `/Users/caner/kong-8/src/kong_backend/src/stable_token/mod.rs`

## 5. Create Token Reply Handling

### 5.1 Create SOL Reply

Create `/Users/caner/kong-8/src/kong_backend/src/tokens/sol_reply.rs`:

```rust
use candid::{CandidType, Deserialize};
use serde::Serialize;

#[derive(CandidType, Clone, Debug, Serialize, Deserialize)]
pub struct SOLReply {
    pub token_id: u32,
    pub chain: String,
    pub name: String,
    pub symbol: String,
    pub address: String,
    pub decimals: u8,
    pub fee: u64,
    pub is_removed: bool,
}
```

### 5.2 Update TokensReply Enum

Update `/Users/caner/kong-8/src/kong_backend/src/tokens/tokens_reply.rs` to add SOL variant:

```rust
use super::sol_reply::SOLReply;

#[derive(CandidType, Clone, Debug, Serialize, Deserialize)]
pub enum TokensReply {
    LP(LPReply),
    IC(ICReply),
    SOL(SOLReply),
}
```

### 5.3 Update tokens_reply_helpers.rs

Update `/Users/caner/kong-8/src/kong_backend/src/tokens/tokens_reply_helpers.rs` to handle SOL tokens.

### 5.4 Update tokens/mod.rs

Add `pub mod sol_reply;` to `/Users/caner/kong-8/src/kong_backend/src/tokens/mod.rs`

## 6. Implement Transaction Support

### 6.1 Update TxId Enum

Update `/Users/caner/kong-8/src/kong_backend/src/stable_transfer/tx_id.rs` to add support for Solana signatures:

```rust
#[derive(Debug, Clone, CandidType, Serialize, Deserialize, PartialEq, Eq)]
pub enum TxId {
    BlockIndex(Nat),
    Signature(String), // Add this variant for Solana transaction signatures
}

impl TxId {
    pub fn to_string(&self) -> String {
        match self {
            TxId::BlockIndex(nat) => format!("BLK:{}", nat),
            TxId::Signature(sig) => format!("SIG:{}", sig),
        }
    }
}
```

## 7. Update Swap Flow

### 7.1 Update Swap Arguments

Update `/Users/caner/kong-8/src/kong_backend/src/swap/swap_args.rs` if needed to handle Solana transaction signatures.

### 7.2 Update Swap Transfer Handler

Update `/Users/caner/kong-8/src/kong_backend/src/swap/swap_transfer.rs` to verify Solana transactions:

```rust
// Add this inside the appropriate function:
TxId::Signature(signature) => {
    // For Solana tokens
    match &pay_token {
        StableToken::SOL(_) => {
            request_map::update_status(request_id, StatusCode::VerifyPayToken, None);
            
            // Verify the transaction
            match sol::verify_transaction::verify_solana_transaction(
                pay_token,
                &signature,
                &pay_amount
            ).await {
                Ok(_) => {
                    // Check if signature was already used
                    if transfer_map::contain_signature(token_id, signature) {
                        let e = format!("Duplicate signature #{}", signature);
                        request_map::update_status(request_id, StatusCode::VerifyPayTokenFailed, Some(&e));
                        Err(e)?
                    }
                    
                    // Record the transfer
                    let transfer_id = transfer_map::insert(&StableTransfer {
                        transfer_id: 0,
                        request_id,
                        is_send: true,
                        amount: pay_amount.clone(),
                        token_id,
                        tx_id: TxId::Signature(signature.to_string()),
                        ts,
                    });
                    
                    request_map::update_status(request_id, StatusCode::VerifyPayTokenSuccess, None);
                    Ok(transfer_id)
                },
                Err(e) => {
                    request_map::update_status(request_id, StatusCode::VerifyPayTokenFailed, Some(&e));
                    Err(e)
                }
            }
        },
        _ => {
            request_map::update_status(request_id, StatusCode::PayTxIdNotSupported, None);
            Err(format!("Signature tx_id not supported for {} tokens", pay_token.chain()))?
        }
    }
}
```

## 8. Update Settings

### 8.1 Update Kong Settings

Update `/Users/caner/kong-8/src/kong_backend/src/stable_kong_settings/stable_kong_settings.rs` to add:

```rust
pub solana_address: Option<String>,
pub solana_rpc_url: Option<String>,
```

### 8.2 Update Default Settings

In the same file, update the Default implementation to include:

```rust
solana_address: None,
solana_rpc_url: Some("https://api.mainnet-beta.solana.com".to_string()),
```

## 9. Update Admin Controllers

### 9.1 Update Kong Settings Controller

Update `/Users/caner/kong-8/src/kong_backend/src/controllers/kong_settings.rs` to add methods for Solana settings.

### 9.2 Add Get Solana Address Method

Add a method to get the canister's Solana address:

```rust
#[query]
pub async fn get_solana_address() -> Result<String, String> {
    let derivation_path = ICNetwork::get_canister_derivation_path();
    let public_key_bytes = ICNetwork::get_schnorr_public_key(derivation_path)
        .await
        .map_err(|e| e.to_string())?;
    let public_key = SolanaNetwork::bs58_encode_public_key(&public_key_bytes);
    Ok(public_key)
}
```

## 10. Add IC Network Module

Create `/Users/caner/kong-8/src/kong_backend/src/ic/network.rs`:

```rust
use candid::Principal;

pub struct ICNetwork {}

impl ICNetwork {
    pub fn canister_id() -> Principal {
        ic_cdk::id()
    }

    pub fn get_canister_derivation_path() -> Vec<Vec<u8>> {
        // use the canister's principal as the derivation path
        vec![ICNetwork::canister_id().as_slice().to_vec()]
    }

    pub fn get_ed25519_key_name() -> String {
        // Based on the error message, the available key is "dfx_test_key"
        // We'll use this for both networks for now, but in production
        // this should be configured properly
        // dfx_text_key local replica
        // test_key_1 Test key available on the ICP testnet
        // key_1 Production key available on the ICP mainnet
        "dfx_test_key".to_string()
    }
    
    pub fn error_log(message: &str) {
        ic_cdk::print(format!("ERROR: {}", message));
    }
}
```

## 11. Add IC Error Module

Create `/Users/caner/kong-8/src/kong_backend/src/ic/error.rs`:

```rust
use candid::{CandidType, Deserialize};
use serde::Serialize;
use std::fmt;

#[derive(CandidType, Debug, Clone, Serialize, Deserialize)]
pub enum ICError {
    SchnorrPublicKeyError(String),
    SchnorrSignatureError(String),
    UnexpectedError(String),
}

impl fmt::Display for ICError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ICError::SchnorrPublicKeyError(msg) => write!(f, "SchnorrPublicKeyError: {}", msg),
            ICError::SchnorrSignatureError(msg) => write!(f, "SchnorrSignatureError: {}", msg),
            ICError::UnexpectedError(msg) => write!(f, "UnexpectedError: {}", msg),
        }
    }
}

impl std::error::Error for ICError {}
```

## 12. Update mod.rs Files

Update IC module exports in `/Users/caner/kong-8/src/kong_backend/src/ic/mod.rs` to include:
```rust
pub mod error;
pub mod network;
pub mod schnorr;
```

## 13. Add Solana to Swap Calc

Check and update swap calculation code if needed to handle Solana tokens properly.

## 14. Testing

Create test scripts for Solana integration:
- Create a test SOL token
- Test SOL swap functionality
- Test SOL LP functionality

## 15. Update Kong Interface

Update `/Users/caner/kong-8/src/kong_backend/kong_backend.did` to expose new Solana-related methods and types.