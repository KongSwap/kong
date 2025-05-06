use anyhow::{anyhow, Result};
use ed25519_consensus::SigningKey;
use ic_agent::identity::{AnonymousIdentity, BasicIdentity, Identity, Secp256k1Identity};
use rand::thread_rng;

pub fn get_anonymous_identity() -> Result<Box<dyn Identity>> {
    Ok(Box::new(AnonymousIdentity))
}

pub fn get_new_identity() -> Result<Box<dyn Identity>> {
    let signing_key = SigningKey::new(thread_rng());
    Ok(Box::new(BasicIdentity::from_signing_key(signing_key)))
}

pub fn get_identity_from_pem_file(pem_file: &str) -> Result<Box<dyn Identity>> {
    match BasicIdentity::from_pem_file(pem_file) {
        Ok(basic_identity) => Ok(Box::new(basic_identity)),
        Err(_) => match Secp256k1Identity::from_pem_file(pem_file) {
            Ok(secp256k1_identity) => Ok(Box::new(secp256k1_identity)),
            Err(_) => Err(anyhow!(
                "Failed to create identity from pem file. Unknown identity format."
            )),
        },
    }
}
