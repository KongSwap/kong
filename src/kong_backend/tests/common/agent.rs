use anyhow::Result;
use ic_agent::identity::Identity;
use ic_agent::Agent;

const LOCAL_REPLICA: &str = "http://localhost:8000";
const MAINNET_REPLICA: &str = "https://ic0.app";

pub async fn create_agent(identity: Box<dyn Identity>, testnet: bool) -> Result<Agent> {
    let replica = if testnet { LOCAL_REPLICA } else { MAINNET_REPLICA };
    let agent = Agent::builder().with_identity(identity).with_url(replica).build()?;
    if testnet {
        agent.fetch_root_key().await?;
    }
    Ok(agent)
}
