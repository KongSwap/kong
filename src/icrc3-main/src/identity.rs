use anyhow::Result;
use ed25519_consensus::SigningKey;
use ic_agent::identity::{AnonymousIdentity, BasicIdentity, Identity};
use rand::thread_rng;

pub fn get_anonymous_identity() -> Result<Box<dyn Identity>> {
    Ok(Box::new(AnonymousIdentity))
}

pub fn get_new_identity() -> Result<Box<dyn Identity>> {
    let signing_key = SigningKey::new(thread_rng());
    Ok(Box::new(BasicIdentity::from_signing_key(signing_key)))
}
