use ic_cdk::query;
use ic_siws::solana::SolPubkey;
use ic_stable_structures::storable::Blob;
use serde_bytes::ByteBuf;

use crate::{PRINCIPAL_ADDRESS, SETTINGS};

/// Retrieves the Solana address associated with a given IC principal.
///
/// # Arguments
/// * `principal` - A `ByteBuf` containing the principal's bytes, expected to be 29 bytes.
#[query]
pub(crate) fn get_address(principal: ByteBuf) -> Result<String, String> {
    SETTINGS.with_borrow(|s| {
        if s.disable_principal_to_sol_mapping {
            return Err("Principal to Solana address mapping is disabled".to_string());
        }
        Ok(())
    })?;

    let principal: Blob<29> = principal
        .as_ref()
        .try_into()
        .map_err(|_| "Failed to convert ByteBuf to Blob<29>")?;

    let address = PRINCIPAL_ADDRESS.with_borrow(|m| m.get(&principal));

    match address {
        Some(address) => Ok(SolPubkey::try_from(address.as_slice())
            .map_err(|_| "Failed to convert Blob<32> to SolPubkey")?
            .to_string()),
        None => Err("Principal not found".to_string()),
    }
}
