/*!
Using the pre built `ic_siws_provider` canister is the easiest way to integrate Solana wallet authentication
into your [Internet Computer](https://internetcomputer.org) application.

The canister is designed as a plug-and-play solution for developers, enabling easy integration into existing
IC applications with minimal coding requirements. By adding the pre built `ic_siws_provider` canister to the
`dfx.json` of an IC project, developers can quickly enable Solana wallet-based authentication for their
applications. The canister simplifies the authentication flow by managing the creation and verification of SIWS
messages and handling user session management.

`ic_siws_provider` is part of the [ic-siws](https://github.com/kristoferlund/ic-siws) project that enables
Solana wallet-based authentication for applications on the Internet Computer (IC) platform. The goal of the
project is to enhance the interoperability between Solana and the Internet Computer platform, enabling
developers to build applications that leverage the strengths of both platforms.

## Features

- **Prebuilt**: The canister is pre built and ready to use.
- **Configurable**: The `ic_siws_provider` canister allows developers to customize the SIWS authentication
  flow to suit their needs.
- **Easy Integration**: The canister can be easily integrated into any Internet Computer application, independent
  of the application's programming language.
- **Keeps Solana Wallets Private**: The canister never has access to the user's Solana wallet, ensuring that
  the user's private keys are never exposed.
- **Session Identity Uniqueness**: Ensures that session identities are specific to each application's context,
  preventing cross-app identity misuse.
- **Consistent Principal Generation**: Guarantees that logging in with an Solana wallet consistently produces
  the same Principal, irrespective of the client used.
- **Direct Solana Address to Principal Mapping**: Creates a one-to-one correlation between Solana addresses and
  Principals within the scope of the current application.
- **Timebound Sessions**: Allows developers to set expiration times for sessions, enhancing security and control.

## Integration overview

See the [ic-siws-react-demo-rust](https://github.com/kristoferlund/ic-siws-react-demo-rust) for a complete example
of how to integrate the `ic_siws_provider` canister into an IC application. The easiest way to get started is to
fork the demo and modify it to suit your needs.

The [integration tests](https://github.com/kristoferlund/ic-siws/blob/main/packages/ic_siws_provider/tests/integration_tests.rs)
for the `ic_siws_provider` canister also provide a good overview of how to integrate the canister into an IC application.

See [README.md](../README.md) for more information.
 */
use ic_cdk::api::set_certified_data;
use ic_certified_map::{fork_hash, labeled_hash, AsHashTree, Hash, RbTree};
use ic_siws::signature_map::SignatureMap;
use ic_siws::siws::SiwsMessage;
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    storable::Blob,
    DefaultMemoryImpl, StableBTreeMap,
};
use std::cell::RefCell;

use ic_siws::delegation::SignedDelegation;
use ic_siws::login::LoginDetails;
use crate::service::init_upgrade::SettingsInput;

use serde_bytes::ByteBuf;

pub mod service;

pub const LABEL_ASSETS: &[u8] = b"http_assets";
pub const LABEL_SIG: &[u8] = b"sig";

pub(crate) type AssetHashes = RbTree<&'static str, Hash>;

pub(crate) struct State {
    pub signature_map: RefCell<SignatureMap>,
    pub asset_hashes: RefCell<AssetHashes>,
}

impl Default for State {
    fn default() -> Self {
        Self {
            signature_map: RefCell::new(SignatureMap::default()),
            asset_hashes: RefCell::new(AssetHashes::default()),
        }
    }
}

#[derive(Default, Debug, Clone)]
pub(crate) struct Settings {
    pub disable_sol_to_principal_mapping: bool,
    pub disable_principal_to_sol_mapping: bool,
}

thread_local! {
    static STATE: State = State::default();

    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    static SETTINGS: RefCell<Settings> = RefCell::new(Settings {
        disable_sol_to_principal_mapping: false,
        disable_principal_to_sol_mapping: false,
    });

    static PRINCIPAL_ADDRESS: RefCell<StableBTreeMap<Blob<29>, [u8;32], VirtualMemory<DefaultMemoryImpl>>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0))),
        )
    );

    static ADDRESS_PRINCIPAL: RefCell<StableBTreeMap<[u8;32], Blob<29>, VirtualMemory<DefaultMemoryImpl>>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(1))),
        )
    );
}

pub(crate) fn update_root_hash(asset_hashes: &AssetHashes, signature_map: &SignatureMap) {
    let prefixed_root_hash = fork_hash(
        &labeled_hash(LABEL_ASSETS, &asset_hashes.root_hash()),
        &labeled_hash(LABEL_SIG, &signature_map.root_hash()),
    );
    set_certified_data(&prefixed_root_hash[..]);
}

// Auto-generate the Candid interface
ic_cdk::export_candid!();
