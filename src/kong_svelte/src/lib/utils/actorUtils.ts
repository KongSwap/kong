import { Actor, HttpAgent } from "@dfinity/agent";
import { getIcHost, isLocalDevelopment, isDfxLocal } from "./environment";

// In-memory cache for anonymous actors
const actorCache = new Map<string, any>();

export const createAnonymousActorHelper = (canisterId: string, idl: any) => {
  const cacheKey = `${canisterId}-${idl.name || "anonymous"}`;
  
  // Clear cache for testing/debugging in development
  if (isLocalDevelopment() && actorCache.has(cacheKey)) {
    console.debug(`[Dev] Using cached actor for ${canisterId}`);
  }
  
  if (actorCache.has(cacheKey)) {
    return actorCache.get(cacheKey);
  }

  // Get the host from our environment utility
  const host = getIcHost();
  
  console.debug(`[Actor] Creating agent for ${canisterId} with host ${host}`);
  
  const agent = HttpAgent.createSync({
    host: host,
  });

  // Fetch root key in local development
  if (isDfxLocal()) {
    try {
      agent.fetchRootKey();
      console.debug("[Actor] Root key fetched successfully");
    } catch (error) {
      console.warn("[Actor] Failed to fetch root key:", error);
    }
  }

  const actor = Actor.createActor(idl as any, {
    agent,
    canisterId,
  });

  actorCache.set(cacheKey, actor);
  return actor;
};
