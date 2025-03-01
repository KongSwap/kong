use candid::Nat;

use super::resolution::*;
use super::transfer_kong::*;

use crate::market::market::*;
use crate::nat::*;
use crate::stable_memory::*;

lazy_static::lazy_static! {
    static ref KONG_TRANSFER_FEE: StorableNat = StorableNat(Nat::from(10_000u64)); // 0.0001 KONG
}

/// Finalizes a market by distributing winnings to successful bettors
pub async fn finalize_market(market: &mut Market, winning_outcomes: Vec<StorableNat>) -> Result<(), ResolutionError> {
    ic_cdk::println!(
        "Finalizing market {} with winning outcomes {:?}",
        market.id.to_u64(),
        winning_outcomes.iter().map(|n| n.to_u64()).collect::<Vec<_>>()
    );
    // Validate market state
    if !matches!(market.status, MarketStatus::Open) {
        return Err(ResolutionError::AlreadyResolved);
    }

    // Validate winning outcomes
    for outcome in &winning_outcomes {
        if outcome.to_u64() as usize >= market.outcomes.len() {
            return Err(ResolutionError::InvalidOutcome);
        }
    }

    // Calculate total winning pool
    let total_winning_pool: StorableNat = winning_outcomes
        .iter()
        .map(|i| market.outcome_pools[i.to_u64() as usize].clone())
        .sum();

    ic_cdk::println!("Total winning pool: {}", total_winning_pool.to_u64());
    ic_cdk::println!("Total market pool: {}", market.total_pool.to_u64());

    if total_winning_pool > 0u64 {
        // Get all winning bets
        let winning_bets = BETS.with(|bets| {
            let bets = bets.borrow();
            if let Some(bet_store) = bets.get(&market.id) {
                bet_store
                    .0
                    .iter()
                    .filter(|bet| winning_outcomes.iter().any(|x| x == &bet.outcome_index))
                    .cloned()
                    .collect::<Vec<_>>()
            } else {
                Vec::new()
            }
        });

        ic_cdk::println!("Found {} winning bets", winning_bets.len());

        // Distribute winnings
        for bet in winning_bets {
            let share = bet.amount.to_f64() / total_winning_pool.to_f64();
            let winnings = StorableNat::from((market.total_pool.to_u64() as f64 * share) as u64);

            ic_cdk::println!(
                "Processing winning bet - User: {}, Original bet: {}, Share: {}, Raw winnings: {}",
                bet.user.to_string(),
                bet.amount.to_u64(),
                share,
                winnings.to_u64()
            );

            // Account for transfer fee
            let transfer_amount = if winnings > KONG_TRANSFER_FEE.clone() {
                winnings - KONG_TRANSFER_FEE.clone()
            } else {
                ic_cdk::println!(
                    "Skipping transfer - winnings {} less than fee {}",
                    winnings.to_u64(),
                    KONG_TRANSFER_FEE.to_u64()
                );
                continue; // Skip if winnings are less than transfer fee
            };

            ic_cdk::println!("Transferring {} tokens to {}", transfer_amount.to_u64(), bet.user.to_string());

            // Transfer winnings to the bettor
            match transfer_kong(bet.user, transfer_amount).await {
                Ok(_) => ic_cdk::println!("Transfer successful"),
                Err(e) => {
                    ic_cdk::println!("Transfer failed: {}", e);
                    return Err(ResolutionError::TransferError(e));
                }
            }
        }
    }

    // Update market status
    market.status = MarketStatus::Closed(winning_outcomes.into_iter().map(|x| x.inner().clone()).collect());
    Ok(())
}
