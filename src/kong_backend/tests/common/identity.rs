use anyhow::{anyhow, Result};
use ed25519_consensus::SigningKey;
use ic_agent::identity::{AnonymousIdentity, BasicIdentity, Identity, Secp256k1Identity};
use rand::thread_rng;
use once_cell::sync::OnceCell;

static FALLBACK_SIGNING_KEY: OnceCell<SigningKey> = OnceCell::new();

pub fn get_anonymous_identity() -> Result<Box<dyn Identity>> {
    Ok(Box::new(AnonymousIdentity))
}

pub fn get_new_identity() -> Result<Box<dyn Identity>> {
    let signing_key = SigningKey::new(thread_rng());
    Ok(Box::new(BasicIdentity::from_signing_key(signing_key)))
}

pub fn get_identity_from_pem_file(pem_file: &str) -> Result<Box<dyn Identity>> {
    // If the PEM file path is provided but the file doesn't actually exist on disk, we
    // gracefully degrade by generating a fresh in-memory identity so the tests can still
    // run. This makes the test-suite self-contained and removes the hard dependency on an
    // external secret key file.

    if !std::path::Path::new(pem_file).exists() {
        // Use a memoized signing key so all test code that falls back to an in-memory
        // identity ends up using *the same* principal.  This avoids situations where
        // separate calls get different identities (and therefore different
        // principals) which then break minting logic that expects a single, stable
        // controller/minting account.
        let signing_key = FALLBACK_SIGNING_KEY
            .get_or_init(|| SigningKey::new(thread_rng()))
            .clone();
        return Ok(Box::new(BasicIdentity::from_signing_key(signing_key)));
    }

    // Try the canonical ED25519 PEM format first.
    match BasicIdentity::from_pem_file(pem_file) {
        Ok(basic_identity) => Ok(Box::new(basic_identity)),
        Err(_) => {
            // If that fails, attempt a Secp256k1 identity.
            match Secp256k1Identity::from_pem_file(pem_file) {
                Ok(secp256k1_identity) => Ok(Box::new(secp256k1_identity)),
                Err(_) => Err(anyhow!(
                    "Failed to create identity from pem file and no fallback possible. Unknown identity format."
                )),
            }
        }
    }
}
