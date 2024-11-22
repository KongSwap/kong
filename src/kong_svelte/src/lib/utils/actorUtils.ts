import { Actor, HttpAgent } from "@dfinity/agent";

// Helper function to create anonymous actor
export const createAnonymousActorHelper = async (canisterId: string, idl: any) => {
  const agent = HttpAgent.createSync({
    host: process.env.DFX_NETWORK !== "ic" ? "http://localhost:4943" : "https://icp0.io",
  });

  // Always fetch root key in local development
  if (process.env.DFX_NETWORK !== "ic") {
    await agent.fetchRootKey().catch(console.error);
  }

  return Actor.createActor(idl as any, {
    agent,
    canisterId,
  });
};
