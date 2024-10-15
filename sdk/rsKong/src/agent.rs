use anyhow::Result;
use ic_agent::{Agent, Identity};

pub async fn create_agent(url: &str, identity: impl 'static + Identity, is_mainnet: bool) -> Result<Agent> {
    let agent = Agent::builder().with_url(url).with_identity(identity).build()?;
    if !is_mainnet {
        agent.fetch_root_key().await?;
    }
    Ok(agent)
}

pub fn create_random_identity() -> impl Identity {
    let rng = ring::rand::SystemRandom::new();
    let key_pair = ring::signature::Ed25519KeyPair::generate_pkcs8(&rng).expect("Could not generate key pair.");

    ic_agent::identity::BasicIdentity::from_key_pair(
        ring::signature::Ed25519KeyPair::from_pkcs8(key_pair.as_ref()).expect("Could not create identity."),
    )
}

/// Secp256k1Identity is the format output by the `dfx identity export user` command.
#[allow(dead_code)]
pub fn create_identity_from_pem_file(pem_file: &str) -> impl Identity {
    ic_agent::identity::Secp256k1Identity::from_pem_file(pem_file).expect("Could not load identity.")
}
