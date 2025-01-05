import { Actor, HttpAgent } from "@dfinity/agent";

// Add polyfill for global
if (typeof window !== 'undefined') {
  (window as any).global = window;
}

// In-memory cache for anonymous actors
const actorCache = new Map<string, any>();

// Helper function to create anonymous actor
export const createAnonymousActorHelper = async (canisterId: string, idl: any) => {
  try {
    // Check cache first
    const cacheKey = `${canisterId}-${idl.name || "anonymous"}`;
    if (actorCache.has(cacheKey)) {
      return actorCache.get(cacheKey);
    }

    const host = import.meta.env.DFX_NETWORK !== "ic"
      ? "http://localhost:4943"
      : "https://icp0.io";

    const agent = new HttpAgent({
      host,
      fetchOptions: {
        headers: {
          'Content-Type': 'application/cbor'
        }
      }
    });

    // Always fetch root key in local development
    if (import.meta.env.DFX_NETWORK !== "ic") {
      try {
        await agent.fetchRootKey();
        console.log('Root key fetched successfully for', canisterId);
      } catch (err) {
        console.error('Failed to fetch root key:', err);
        throw new Error(`Root key fetch failed for ${canisterId}: ${err.message}`);
      }
    }

    const actor = Actor.createActor(idl, {
      agent,
      canisterId,
    });

    // Cache the actor
    actorCache.set(cacheKey, actor);
    return actor;

  } catch (error) {
    console.error('Actor creation failed:', error);
    throw new Error(`Failed to create actor for ${canisterId}: ${error.message}`);
  }
};

// Helper to clear actor cache
export const clearActorCache = () => {
  actorCache.clear();
};

// Helper to check if agent can connect
export const checkAgentConnection = async () => {
  try {
    const host = import.meta.env.DFX_NETWORK !== "ic"
      ? "http://localhost:4943"
      : "https://icp0.io";

    const agent = new HttpAgent({ host });
    
    if (import.meta.env.DFX_NETWORK !== "ic") {
      await agent.fetchRootKey();
    }
    
    return true;
  } catch (error) {
    console.error('Agent connection check failed:', error);
    return false;
  }
};

// Helper to get agent status
export const getAgentStatus = async () => {
  try {
    const host = import.meta.env.DFX_NETWORK !== "ic"
      ? "http://localhost:4943"
      : "https://icp0.io";

    const agent = new HttpAgent({ host });
    
    if (import.meta.env.DFX_NETWORK !== "ic") {
      await agent.fetchRootKey();
    }

    return {
      connected: true,
      host,
      network: import.meta.env.DFX_NETWORK
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
      host: import.meta.env.DFX_NETWORK !== "ic"
        ? "http://localhost:4943"
        : "https://icp0.io",
      network: import.meta.env.DFX_NETWORK
    };
  }
};
