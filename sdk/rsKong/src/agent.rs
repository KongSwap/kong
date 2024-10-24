use anyhow::Result;
use ed25519_consensus::SigningKey;
use ic_agent::{Agent, Identity};
use rand::thread_rng;

pub async fn create_agent(url: &str, identity: impl 'static + Identity, is_mainnet: bool) -> Result<Agent> {
    let agent = Agent::builder().with_url(url).with_identity(identity).build()?;
    if !is_mainnet {
        agent.fetch_root_key().await?;
    }
    Ok(agent)
}

pub fn create_random_identity() -> impl Identity {
    let signing_key = SigningKey::new(thread_rng());
    ic_agent::identity::BasicIdentity::from_signing_key(signing_key)
}

/// Secp256k1Identity is the format output by the `dfx identity export user` command.
#[allow(dead_code)]
pub fn create_identity_from_pem_file(pem_file: &str) -> impl Identity {
    ic_agent::identity::Secp256k1Identity::from_pem_file(pem_file).expect("Could not load identity.")
}
