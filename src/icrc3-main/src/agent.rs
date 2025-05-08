use anyhow::Result;
use ic_agent::Agent;
use ic_agent::identity::Identity;

const LOCAL_REPLICA_URL: &str = "http://localhost:4943";
const MAINNET_REPLICA_URL: &str = "https://ic0.app";

pub async fn get_agent(
    identity: Box<dyn Identity>,
    mainnet_replica: Option<bool>,
) -> Result<Agent> {
    let mainnet_replica = mainnet_replica.unwrap_or(false);

    let replica_url = if mainnet_replica {
        MAINNET_REPLICA_URL
    } else {
        LOCAL_REPLICA_URL
    };
    let agent = Agent::builder()
        .with_identity(identity)
        .with_url(replica_url)
        .build()?;
    if !mainnet_replica {
        agent.fetch_root_key().await?;
    }

    Ok(agent)
}
