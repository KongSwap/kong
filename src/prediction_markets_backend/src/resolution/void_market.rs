use ic_cdk::update;
use candid::Nat;

use super::resolution::*;
use super::transfer_kong::*;

use crate::market::market::*;
use crate::nat::*;
use crate::stable_memory::*;
use crate::controllers::admin::*;

lazy_static::lazy_static! {
    static ref KONG_TRANSFER_FEE: StorableNat = StorableNat(Nat::from(10_000u64)); // 0.0001 KONG
}

/// Voids a market and returns all bets to the users
/// This is used when no resolution can be determined or in case of market manipulation
#[update]
pub async fn void_market(market_id: MarketId) -> Result<(), ResolutionError> {
    let admin = ic_cdk::caller();

    // Verify the caller is an admin
    if !is_admin(admin) {
        return Err(ResolutionError::Unauthorized);
    }

    // Get market and validate state
    let mut market = MARKETS.with(|markets| {
        let markets_ref = markets.borrow();
        markets_ref.get(&market_id).ok_or(ResolutionError::MarketNotFound)
    })?;

    // Verify market is not already resolved
    if !matches!(market.status, MarketStatus::Open | MarketStatus::Disputed) {
        return Err(ResolutionError::AlreadyResolved);
    }

    ic_cdk::println!("Voiding market {}", market_id.to_u64());

    // Get all bets for this market
    let bets = BETS.with(|bets| {
        let bets = bets.borrow();
        if let Some(bet_store) = bets.get(&market_id) {
            bet_store.0.clone()
        } else {
            Vec::new()
        }
    });

    ic_cdk::println!("Found {} bets to refund", bets.len());

    // Return all bets to users
    for bet in bets {
        let transfer_amount = if bet.amount > KONG_TRANSFER_FEE.clone() {
            bet.amount - KONG_TRANSFER_FEE.clone()
        } else {
            ic_cdk::println!(
                "Skipping transfer - bet amount {} less than fee {}",
                bet.amount.to_u64(),
                KONG_TRANSFER_FEE.to_u64()
            );
            continue; // Skip if bet amount is less than transfer fee
        };

        ic_cdk::println!("Returning {} tokens to {}", transfer_amount.to_u64(), bet.user.to_string());

        // Transfer tokens back to the bettor
        match transfer_kong(bet.user, transfer_amount).await {
            Ok(_) => ic_cdk::println!("Transfer successful"),
            Err(e) => {
                ic_cdk::println!("Transfer failed: {}", e);
                return Err(ResolutionError::TransferError(e));
            }
        }
    }

    // Update market status to Voided
    market.status = MarketStatus::Voided;
    
    // Update market in storage
    MARKETS.with(|markets| {
        let mut markets_ref = markets.borrow_mut();
        markets_ref.insert(market_id, market);
    });

    Ok(())
}
