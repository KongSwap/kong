//! # Stable Memory System
//!
//! This module implements the persistence layer for the Kong Swap prediction markets platform,
//! ensuring all critical data survives canister upgrades and system restarts. It uses the
//! Internet Computer's stable memory system to maintain state across code upgrades.
//!
//! The stable memory system stores:
//! - Markets with their complete configurations and states
//! - Bets placed by users on each market
//! - Resolution proposals for the dual approval system
//! - User delegations and oracle whitelist
//!
//! Each data type is stored in a separate `StableBTreeMap` with its own memory region,
//! managed by a central memory manager that allocates virtual memory segments.

use candid::Principal;
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl, StableBTreeMap, Storable,
};

use std::cell::RefCell;

use crate::{user::user_betting_summary::recalculate_betting_summary_impl, BetPayoutRecord};
use crate::{types::StorableNat, ClaimRecord};

use super::delegation::*;

use crate::failed_transaction::FailedTransaction;
use crate::market::create_market::MARKET_ID;
use crate::market::market::*;
use crate::resolution::resolution::ResolutionProposal;
use crate::storable_vec::StorableVec;
use crate::storage::MARKET_RESOLUTION_DETAILS;
use crate::token::registry::{TokenIdentifier, TokenInfo};
use crate::types::{MarketId, MarketResolutionDetails};
/// Type alias for the virtual memory used by stable collections
///
/// This is a virtual memory region backed by the Internet Computer's DefaultMemoryImpl,
/// which provides guaranteed persistence across canister upgrades.
pub type Memory = VirtualMemory<DefaultMemoryImpl>;

// Stable memory configuration for persistent data storage
thread_local! {
    /// Stable memory configuration using thread_local storage
    ///
    /// These thread-local variables define the stable data structures that persist
    /// across canister upgrades. Each structure is allocated a specific memory region
    /// by the memory manager ensuring data isolation and integrity.
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> = RefCell::new(
        MemoryManager::init(DefaultMemoryImpl::default())
    );

    /// Stable BTree map for markets indexed by MarketId
    pub static STABLE_MARKETS: RefCell<StableBTreeMap<MarketId, Market, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|mm| mm.borrow().get(MemoryId::new(0)))
        )
    );

    /// Stable BTree map for bets indexed by a composite key of MarketId + BetId
    pub static STABLE_BETS: RefCell<StableBTreeMap<crate::bet::bet::BetKey, crate::bet::bet::Bet, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|mm| mm.borrow().get(MemoryId::new(1)))
        )
    );

    /// Stable BTree map for resolution proposals indexed by MarketId
    pub static STABLE_RESOLUTION_PROPOSALS: RefCell<StableBTreeMap<MarketId, ResolutionProposal, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|mm| mm.borrow().get(MemoryId::new(2)))
        )
    );

    /// Stable BTree map for delegations indexed by Principal (delegator)
    pub static STABLE_DELEGATIONS: RefCell<StableBTreeMap<Principal, Delegation, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|mm| mm.borrow().get(MemoryId::new(3)))
        )
    );

    /// Stable set of oracle principals
    pub static STABLE_ORACLE_WHITELIST: RefCell<StableBTreeMap<Principal, bool, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|mm| mm.borrow().get(MemoryId::new(4)))
        )
    );

    // The claims data storage is already defined above

    /// Stores user token balances
    ///
    /// This collection tracks token balances for each user, indexed by their Principal ID.
    /// Uses memory region 5 and is used for legacy token handling before the multi-token
    /// system was implemented. New markets use direct ledger transfers instead.
    pub static BALANCES: RefCell<StableBTreeMap<Principal, u64, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(5))),
        )
    );

    /// Stores the accumulated house fees
    ///
    /// This collection tracks platform fees collected from markets, organized by token type.
    /// Uses memory region 6 and is primarily used for administrative accounting and
    /// fee withdrawal operations. For KONG tokens, fees are burned rather than collected.
    /// Uses StorableNat to support tokens with high decimal precision like ckETH (18 decimals).
    pub static FEE_BALANCE: RefCell<StableBTreeMap<Principal, StorableNat, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(6))),
        )
    );

    /// Stable storage for claims data (used for upgrade persistence)
    ///
    /// Storage for the in-memory claim state during upgrades
    /// This is used to persist claims, user_claims, market_claims, and (next_claim_id, market_id)
    pub static STABLE_CLAIMS_DATA: RefCell<(
        StableBTreeMap<StorableNat, ClaimRecord, Memory>,
        StableBTreeMap<Principal, StorableVec<StorableNat>, Memory>,
        StableBTreeMap<MarketId, StorableVec<StorableNat>, Memory>,
        StableBTreeMap<StorableNat, StorableNat, Memory>,
    )> = RefCell::new((
        StableBTreeMap::init(MEMORY_MANAGER.with(|mm| mm.borrow().get(MemoryId::new(7)))),
        StableBTreeMap::init(MEMORY_MANAGER.with(|mm| mm.borrow().get(MemoryId::new(8)))),
        StableBTreeMap::init(MEMORY_MANAGER.with(|mm| mm.borrow().get(MemoryId::new(9)))),
        StableBTreeMap::init(MEMORY_MANAGER.with(|mm| mm.borrow().get(MemoryId::new(10)))),
    ));

    /// Storage for market resolution details during upgrades
    /// This stores detailed information about how markets were resolved
    /// Raw storage format: Vec<(MarketId, MarketResolutionDetails)>
    pub static STABLE_MARKET_RESOLUTION_DETAILS: RefCell<StableBTreeMap<MarketId, MarketResolutionDetails, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|mm| mm.borrow().get(MemoryId::new(11))))
    );

    /// Storage for market payout records during upgrades
    /// This stores detailed information about payouts for each market
    /// Raw storage format: Vec<(MarketId, Vec<BetPayoutRecord>)>
    pub static STABLE_MARKET_PAYOUTS: RefCell<StableBTreeMap<MarketId, StorableVec<BetPayoutRecord>, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|mm| mm.borrow().get(MemoryId::new(12))))
    );

    pub static STABLE_TOKEN_REGISTRY: RefCell<StableBTreeMap<TokenIdentifier, TokenInfo, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|mm| mm.borrow().get(MemoryId::new(13))))
    );

    pub static STABLE_FAILED_TRANSACTIONS: RefCell<StableBTreeMap<u64, FailedTransaction, Memory>> = RefCell::new(
        StableBTreeMap::init(MEMORY_MANAGER.with(|mm| mm.borrow().get(MemoryId::new(14))))
    );
}

fn fill_stable_map<K, V, It>(m: &mut StableBTreeMap<K, V, Memory>, iter: &mut It)
where
    K: Storable + Ord + Clone,
    V: Storable,
    It: Iterator<Item = (K, V)>,
{
    m.clear_new();

    loop {
        match iter.next() {
            None => return,
            Some(v) => _ = m.insert(v.0, v.1),
        }
    }
}

/// Saves the current state to stable memory before an upgrade
///
/// This function is automatically called before any canister upgrade through
/// the pre_upgrade hook in lib.rs. It prepares critical application state
/// for persistence across the upgrade process.
///
/// # Details
/// The stable BTree maps (markets, bets, etc.) handle their own serialization,
/// so this function focuses on persisting other in-memory data that isn't
/// already in stable storage, such as the claims system data and market resolution details.
pub fn save() {
    // Save claims data to stable storage
    let claims_data = crate::claims::claims_storage::export_claims();

    // Convert HashMaps to Vec<(K,V)> for stable storage
    let mut claims_it = claims_data.0.into_iter().map(|v| (v.0.into(), v.1));
    let mut user_claims_it = claims_data
        .1
        .into_iter()
        .map(|v| (v.0, StorableVec::from_vec(v.1.into_iter().map(StorableNat::from_u64).collect())));

    let mut market_claims_it = claims_data
        .2
        .into_iter()
        .map(|v| (v.0, StorableVec::from_vec(v.1.into_iter().map(StorableNat::from_u64).collect())));

    STABLE_CLAIMS_DATA.with(|stable_claims| {
        let mut stable_claims = stable_claims.borrow_mut();
        fill_stable_map(&mut stable_claims.0, &mut claims_it);
        fill_stable_map(&mut stable_claims.1, &mut user_claims_it);
        fill_stable_map(&mut stable_claims.2, &mut market_claims_it);
        let _ = stable_claims
            .3
            .insert(StorableNat::from_u64(0), StorableNat::from_u64(claims_data.3));

        let _ = stable_claims.3.insert(
            StorableNat::from_u64(0),
            StorableNat::from_u64(MARKET_ID.load(std::sync::atomic::Ordering::SeqCst)),
        );
    });

    // Save market resolution details to stable storage
    MARKET_RESOLUTION_DETAILS.with(|details_map| {
        let details_map = details_map.borrow();

        let mut resolution_details_it = details_map.iter().map(|v| (v.0.clone(), v.1.clone()));

        STABLE_MARKET_RESOLUTION_DETAILS.with(|stable_details| {
            fill_stable_map(&mut stable_details.borrow_mut(), &mut resolution_details_it);
        });
    });

    // Save market payout records to stable storage
    crate::canister::MARKET_PAYOUTS.with(|payouts| {
        let payouts = payouts.borrow();
        let mut payouts_it = payouts
            .iter()
            .map(|v| (v.0.clone(), StorableVec::from_vec(v.1.iter().map(|i| i.clone()).collect())));

        STABLE_MARKET_PAYOUTS.with(|stable_payouts| {
            fill_stable_map(&mut stable_payouts.borrow_mut(), &mut payouts_it);
        });
    });

    // Save token registry
    let mut tokens_it = crate::token::registry::get_all_supported_tokens()
        .into_iter()
        .map(|t| (t.id.clone(), t));
    STABLE_TOKEN_REGISTRY.with(|token_registry| {
        fill_stable_map(&mut token_registry.borrow_mut(), &mut tokens_it);
    })
}

/// Restores the stable memory state after a canister upgrade
///
/// This function is called by the post_upgrade hook in lib.rs and performs
/// necessary initialization after a canister code upgrade. While the stable memory
/// itself is automatically preserved, this function handles additional state
/// synchronization like setting the market ID counter.
///
/// # Details
/// 1. The stable memory structures (markets, bets, etc.) are automatically preserved
/// 2. The market ID counter is set to match the highest existing market ID to
///    ensure new markets receive unique, sequential IDs
/// 3. Claims data is restored from stable storage if available
/// 4. Any future migrations or state adjustments can be added to this function
///
/// # Usage
/// This should only be called from the post_upgrade hook in lib.rs
pub fn restore() {
    // Restore claims data if available
    STABLE_CLAIMS_DATA.with(|stable_claims| {
        let all_claims = stable_claims.borrow();

        let claims: std::collections::HashMap<u64, ClaimRecord> = all_claims.0.iter().map(|v| (v.0.to_u64(), v.1)).collect();

        let user_claims: std::collections::HashMap<Principal, Vec<u64>> = all_claims
            .1
            .iter()
            .map(|v| (v.0, v.1.iter().map(|i| i.to_u64()).collect()))
            .collect();

        let market_claims: std::collections::HashMap<MarketId, Vec<u64>> = all_claims
            .2
            .iter()
            .map(|v| (v.0, v.1.iter().map(|i| i.to_u64()).collect()))
            .collect();

        let next_id = all_claims.3.get(&StorableNat::from_u64(0)).map(|v| v.to_u64()).unwrap_or(1);

        crate::claims::claims_storage::import_claims(claims, user_claims, market_claims, next_id);

        pub fn max_market_id() -> u64 {
            STABLE_MARKETS.with(|m| m.borrow().last_key_value().map_or(0, |(k, _)| k.to_u64()))
        }

        let new_market_id = all_claims
            .3
            .get(&StorableNat::from_u64(0))
            .map(|v| v.to_u64())
            .unwrap_or(max_market_id());
        MARKET_ID.store(new_market_id, std::sync::atomic::Ordering::SeqCst);
    });

    // Restore market resolution details if available
    STABLE_MARKET_RESOLUTION_DETAILS.with(|stable_details| {
        let stable_details_vec = stable_details.borrow_mut();
        // Convert Vec<(K,V)> back to HashMap
        let resolution_details: std::collections::HashMap<MarketId, MarketResolutionDetails> = stable_details_vec.iter().collect();

        // Restore to the in-memory HashMap
        MARKET_RESOLUTION_DETAILS.with(|details_map| {
            *details_map.borrow_mut() = resolution_details;
        });
    });

    // Restore market payout records if available
    STABLE_MARKET_PAYOUTS.with(|stable_payouts| {
        let stable_payouts_vec = stable_payouts.borrow_mut();
        // Convert Vec<(MarketId, Vec<BetPayoutRecord>)> back to BTreeMap
        let market_payouts: std::collections::BTreeMap<MarketId, Vec<BetPayoutRecord>> = stable_payouts_vec
            .iter()
            .map(|v| (v.0, v.1.iter().map(|i| i.clone()).collect()))
            .collect();

        // Restore to the in-memory BTreeMap
        crate::canister::MARKET_PAYOUTS.with(|payouts| {
            *payouts.borrow_mut() = market_payouts;
        });
    });

    // Restore token registry
    STABLE_TOKEN_REGISTRY.with(|token_registry| {
        for v in token_registry.borrow().values() {
            crate::token::registry::add_supported_token(v);
        }
    });

    recalculate_betting_summary_impl();
}
