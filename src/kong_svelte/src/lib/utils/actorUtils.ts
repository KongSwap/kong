import { Actor, HttpAgent } from "@dfinity/agent";

// In-memory cache for anonymous actors
const actorCache = new Map<string, any>();

// Helper function to create anonymous actor
export const createAnonymousActorHelper = async (canisterId: string, idl: any) => {
  // Check cache first
  const cacheKey = `${canisterId}-${idl.name || 'anonymous'}`;
  if (actorCache.has(cacheKey)) {
    return actorCache.get(cacheKey);
  }

  const agent = HttpAgent.createSync({
    host: process.env.DFX_NETWORK !== "ic" ? "http://localhost:4943" : "https://icp0.io",
  });

  // Always fetch root key in local development
  if (process.env.DFX_NETWORK !== "ic") {
    await agent.fetchRootKey().catch(console.error);
  }

  const actor = Actor.createActor(idl as any, {
    agent,
    canisterId,
  });

  // Cache the actor
  actorCache.set(cacheKey, actor);
  return actor;
};
