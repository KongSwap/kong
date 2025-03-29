use anyhow::Result;
use ed25519_consensus::SigningKey;
use ic_agent::identity::{AnonymousIdentity, BasicIdentity, Secp256k1Identity};
use ic_agent::{Agent, Identity};
use rand::thread_rng;

pub async fn create_agent_from_identity(url: &str, identity: impl 'static + Identity, is_mainnet: bool) -> Result<Agent> {
    let agent = Agent::builder().with_url(url).with_identity(identity).build()?;
    if !is_mainnet {
        agent.fetch_root_key().await?;
    }
    Ok(agent)
}

#[allow(dead_code)]
pub fn create_anonymous_identity() -> impl Identity {
    AnonymousIdentity
}

#[allow(dead_code)]
pub fn create_random_identity() -> impl Identity {
    let signing_key = SigningKey::new(thread_rng());
    BasicIdentity::from_signing_key(signing_key)
}

/// Secp256k1Identity is the format output by the `dfx identity export user` command.
#[allow(dead_code)]
pub fn create_identity_from_pem_file(pem_file: &str) -> Result<Box<dyn Identity>> {
    match BasicIdentity::from_pem_file(pem_file) {
        Ok(basic_identity) => Ok(Box::new(basic_identity)),
        Err(_) => match Secp256k1Identity::from_pem_file(pem_file) {
            Ok(secp256k1_identity) => Ok(Box::new(secp256k1_identity)),
            Err(_) => Err(anyhow::anyhow!("Failed to create identity from pem file. Unknown identity format.")),
        },
    }
}
