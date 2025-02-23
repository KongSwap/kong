import { HttpAgent } from '@dfinity/agent';

let agent: HttpAgent | null = null;

export async function getDefaultAgent(): Promise<HttpAgent> {
  if (agent) return agent;

  // Create a new agent
  agent = new HttpAgent({
    host: process.env.DFX_NETWORK === 'ic' 
      ? 'https://ic0.app' 
      : 'http://localhost:4943'
  });

  // Only fetch root key in development
  if (process.env.DFX_NETWORK !== 'ic') {
    await agent.fetchRootKey();
  }

  return agent;
}
