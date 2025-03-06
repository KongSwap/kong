// Extract unique deployers for UNIQUE USER COUNT
export function extractUniqueDeployers(canisters) {
  if (!canisters || !Array.isArray(canisters)) return new Set();

  // Get all unique principals that deployed anything
  const deployers = new Set();
  canisters.forEach((canister) => {
    if (canister.principal || canister.owner) {
      deployers.add(canister.principal || canister.owner);
    }
  });

  return deployers;
}

// Calculate bullshit "activity score" for dopamine hits
export function calculateActivityScore(tokensCount, minersCount, deployersCount) {
  // Completely arbitrary formula to create a "score" that looks impressive
  return Math.floor(
    tokensCount * 75 +
      minersCount * 150 +
      deployersCount * 50 +
      (Date.now() % 1000),
  );
}

// Get a readable name for a canister if possible
export function getCanisterName(data) {
  if (!data) return null;
  if (data.metadata?.name) return data.metadata.name;
  if (data.metadata?.ticker) return data.metadata.ticker;
  if (data.name) return data.name;
  return null;
}

// Convert WebSocket event to human-readable text WITH DEGEN ENERGY
export function getEventText(event) {
  switch (event.type) {
    case "canister_registered":
      return `🚀 NEW ${event.data?.canister_type === "token_backend" ? "💰 TOKEN" : "⛏️ MINER"} LAUNCH: ${event.data?.canister_id.substring(0, 8)}...`;
    case "refresh":
      return `🔄 REGISTRY SYNCED WITH ${event.canistersList?.length || 0} CANISTERS`;
    case "error":
      return `⚠️ ERROR: ${typeof event.data === "string" ? event.data : "Unknown error"}`;
    default:
      if (event.type.includes("mining")) {
        return `⛏️ MINING ACTIVITY: ${JSON.stringify(event.data).substring(0, 30)}...`;
      }
      return null;
  }
}

// ULTIMATE FALLBACK: Try to create token if everything else fails
export function tryFallbackToken(canister, tokenList) {
  try {
    console.log(`🧪 EXPERIMENTAL TOKEN DETECTION: ${canister.canister_id}`);
    tokenList.push({
      decimals: 8,
      ticker: `UNK-${canister.canister_id.substring(0, 4)}`,
      transfer_fee: BigInt(0),
      logo: [],
      name: `Unknown Token ${canister.canister_id.substring(0, 8)}`,
      ledger_id: [],
      total_supply: BigInt(0),
      principal: canister.canister_id,
      version: canister.module_hash?.substring(0, 9) || "unknown",
      dateCreated: new Date(canister.created_at || Date.now()),
    });
  } catch (error) {
    console.error("Error creating fallback token:", error);
  }
}

// Process canister list to separate tokens and miners with ULTRA-DEGEN detection
export function processCanisters(canisters) {
  const tokenList = [];
  const minerList = [];

  if (!canisters || !Array.isArray(canisters)) {
    console.error("Invalid canister data:", canisters);
    return { tokenList, minerList, rawCanisters: [] };
  }

  // Debug info
  console.log(`🧠 PROCESSING ${canisters.length} CANISTERS 🧠`);

  // Extract unique deployers for our metrics
  const deployerSet = extractUniqueDeployers(canisters);

  // ULTRA-DEGENERATE TOKEN/MINER DETECTION LOGIC
  canisters.forEach((canister) => {
    const canisterType = canister.canister_type
      ? canister.canister_type.toLowerCase()
      : "";
    const metadata = canister.metadata || {};

    // Token detection - MAXIMUM AGGRESSION
    if (
      canisterType.includes("token") ||
      canister.name?.toLowerCase().includes("token") ||
      metadata.ticker ||
      metadata.decimals ||
      metadata.transfer_fee ||
      metadata.is_token === true ||
      (metadata.token_metadata &&
        Object.keys(metadata.token_metadata).length > 0) ||
      (metadata.name &&
        typeof metadata.name === "string" &&
        metadata.name.length > 0) ||
      // EVEN MORE AGGRESSIVE CHECKS
      canister.description?.toLowerCase().includes("token") ||
      metadata.symbol ||
      metadata.fee !== undefined
    ) {
      try {
        console.log(`🪙 DETECTED TOKEN: ${canister.canister_id}`);
        tokenList.push({
          decimals: metadata.decimals || 8,
          ticker: metadata.ticker || metadata.symbol || "UNKNOWN",
          transfer_fee: BigInt(metadata.transfer_fee || metadata.fee || 0),
          logo: metadata.logo ? [metadata.logo] : [],
          name:
            metadata.name || `Token ${canister.canister_id.substring(0, 8)}`,
          ledger_id: [],
          total_supply: BigInt(metadata.total_supply || 0),
          principal: canister.canister_id,
          version: canister.module_hash?.substring(0, 9) || "unknown",
          dateCreated: new Date(canister.created_at || Date.now()),
        });
      } catch (error) {
        console.error("Error processing token canister:", error);
        // FALLBACK DETECTION - NEVER GIVE UP
        tryFallbackToken(canister, tokenList);
      }
    }
    // Miner detection - MAXIMUM AGGRESSION
    else if (
      canisterType.includes("miner") ||
      canister.name?.toLowerCase().includes("miner") ||
      canister.name?.toLowerCase().includes("mining") ||
      metadata.is_mining === true ||
      metadata.mining_stats ||
      metadata.hash_rate ||
      metadata.blocks_mined ||
      // EVEN MORE AGGRESSIVE CHECKS
      (metadata &&
        (JSON.stringify(metadata).includes("mining") ||
          JSON.stringify(metadata).includes("hash") ||
          JSON.stringify(metadata).includes("reward") ||
          JSON.stringify(metadata).includes("block")))
    ) {
      try {
        console.log(`⛏️ DETECTED MINER: ${canister.canister_id}`);
        minerList.push({
          owner: canister.principal || canister.owner || "unknown",
          current_token: [],
          is_mining: metadata.is_mining || false,
          type: metadata.type || { Normal: null },
          mining_stats: metadata.mining_stats || {
            total_hashes: BigInt(0),
            blocks_mined: BigInt(0),
            total_rewards: BigInt(0),
            last_hash_rate: 0,
            start_time: BigInt(canister.created_at || Date.now()),
          },
          principal: canister.canister_id,
          version: canister.module_hash?.substring(0, 9) || "unknown",
          dateCreated: new Date(canister.created_at || Date.now()),
        });
      } catch (error) {
        console.error("Error processing miner canister:", error);
      }
    }
    // FALLBACK TO TOKEN - MORE COMMON
    else if (Object.keys(metadata).length > 0) {
      tryFallbackToken(canister, tokenList);
    }
  });

  console.log(
    `🦈 SHARK MODE DETECTED: ${tokenList.length} TOKENS, ${minerList.length} MINERS, ${deployerSet.size} USERS`,
  );

  return { tokenList, minerList, rawCanisters: canisters, deployerSet };
}

// Update stats based on canister data - DEGENERATE EDITION
export function updateStatsFromCanisters(tokenList, minerList, deployerSet) {
  const stats = {
    totalTokens: tokenList.length,
    totalMiners: minerList.length,
    totalDeployments: tokenList.length + minerList.length,
    uniqueDeployers: deployerSet.size,
    activityScore: 0,
    lastDeployment: null
  };

  // Find most recent deployment
  const allDeployments = [...tokenList, ...minerList];
  if (allDeployments.length > 0) {
    const sortedByDate = [...allDeployments].sort(
      (a, b) => b.dateCreated.getTime() - a.dateCreated.getTime(),
    );
    stats.lastDeployment = sortedByDate[0].dateCreated;
  }

  // Calculate bullshit activity score
  stats.activityScore = calculateActivityScore(
    tokenList.length,
    minerList.length,
    deployerSet.size,
  );

  return stats;
}

// Sort items based on sort field and direction
export function sortItems(items, sortField, sortDirection) {
  return [...items].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case "date":
        comparison = a.dateCreated.getTime() - b.dateCreated.getTime();
        break;
      case "name":
        comparison = (a.name || a.owner).localeCompare(b.name || b.owner);
        break;
      case "principal":
        comparison = a.principal.localeCompare(b.principal);
        break;
      case "version":
        comparison = a.version.localeCompare(b.version);
        break;
    }
    return sortDirection === "desc" ? -comparison : comparison;
  });
}

// Filter tokens based on search query
export function filterTokens(tokens, searchQuery) {
  return tokens.filter((token) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      token.name.toLowerCase().includes(searchLower) ||
      token.ticker.toLowerCase().includes(searchLower) ||
      token.principal.toLowerCase().includes(searchLower) ||
      token.version.toLowerCase().includes(searchLower) ||
      token.dateCreated.toLocaleDateString().includes(searchLower)
    );
  });
}

// Filter miners based on search query
export function filterMiners(miners, searchQuery) {
  return miners.filter((miner) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      miner.owner.toLowerCase().includes(searchLower) ||
      miner.principal.toLowerCase().includes(searchLower) ||
      miner.version.toLowerCase().includes(searchLower) ||
      miner.dateCreated.toLocaleDateString().includes(searchLower)
    );
  });
} 