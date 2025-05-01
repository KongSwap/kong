use std::str::FromStr;

use ic_cdk::query;
use ic_siws::solana::SolPubkey;
use serde_bytes::ByteBuf;

use crate::{ADDRESS_PRINCIPAL, SETTINGS};

/// Retrieves the principal associated with the given Solana address.
#[query]
fn get_principal(address: String) -> Result<ByteBuf, String> {
    SETTINGS.with_borrow(|s| {
        if s.disable_sol_to_principal_mapping {
            return Err("Solana pubkey to principal mapping is disabled".to_string());
        }
        Ok(())
    })?;

    let address = SolPubkey::from_str(address.as_str()).map_err(|e| e.to_string())?;

    ADDRESS_PRINCIPAL.with(|ap| {
        ap.borrow().get(&address.to_bytes()).map_or(
            Err("No principal found for the given address".to_string()),
            |p| Ok(ByteBuf::from(p.as_ref().to_vec())),
        )
    })
}
