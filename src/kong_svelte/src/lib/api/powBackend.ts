import { canisters, type CanisterType } from "$lib/config/auth.config";
import { auth } from "$lib/stores/auth";
import { notificationsStore } from "$lib/stores/notificationsStore";
import { Principal } from "@dfinity/principal";
import type { 
  BlockTemplate, 
  TokenInfo, 
  MinerInfo, 
  MiningInfo, 
  SocialLink,
  TokenAllInfo,
  TokenMetrics
} from "../../../../declarations/pow_backend/pow_backend.did.d.ts";

/**
 * Gets information about a token
 */
export async function getTokenInfo(powBackendId: string): Promise<TokenInfo> {
  try {
    const actor = auth.pnp.getActor<CanisterType['POW_BACKEND']>({
      canisterId: powBackendId,
      idl: canisters.powBackend.idl,
      anon: true,
    });
    
    const result = await actor.get_info();
    
    if ("Err" in result) {
      throw new Error(`Failed to get token info: ${result.Err}`);
    }
    
    return result.Ok;
  } catch (error) {
    console.error("Failed to get token info", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to get token info: ${JSON.stringify(error)}`);
  }
}

/**
 * Gets all token information including metrics
 */
export async function getAllTokenInfo(powBackendId: string): Promise<TokenAllInfo> {
  try {
    const actor = auth.pnp.getActor<CanisterType['POW_BACKEND']>({
      canisterId: powBackendId,
      idl: canisters.powBackend.idl,
      anon: true,
    });
    
    const result = await actor.get_all_info();
    
    if ("Err" in result) {
      throw new Error(`Failed to get all token info: ${result.Err}`);
    }
    
    return result.Ok;
  } catch (error) {
    console.error("Failed to get all token info", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to get all token info: ${JSON.stringify(error)}`);
  }
}

/**
 * Gets token metrics
 */
export async function getTokenMetrics(powBackendId: string): Promise<TokenMetrics> {
  try {
    const actor = auth.pnp.getActor<CanisterType['POW_BACKEND']>({
      canisterId: powBackendId,
      idl: canisters.powBackend.idl,
      anon: true,
    });
    
    const result = await actor.get_metrics();
    
    if ("Err" in result) {
      throw new Error(`Failed to get token metrics: ${result.Err}`);
    }
    
    return result.Ok;
  } catch (error) {
    console.error("Failed to get token metrics", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to get token metrics: ${JSON.stringify(error)}`);
  }
}

/**
 * Gets information about all registered miners
 */
export async function getAllMiners(powBackendId: string): Promise<MinerInfo[]> {
  try {
    const actor = auth.pnp.getActor<CanisterType['POW_BACKEND']>({
      canisterId: powBackendId,
      idl: canisters.powBackend.idl,
      anon: true,
    });
    
    return await actor.get_miners();
  } catch (error) {
    console.error("Failed to get all miners", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to get all miners: ${JSON.stringify(error)}`);
  }
}

/**
 * Gets the miner leaderboard
 */
export async function getMinerLeaderboard(powBackendId: string, limit?: number): Promise<MinerInfo[]> {
  try {
    const actor = auth.pnp.getActor<CanisterType['POW_BACKEND']>({
      canisterId: powBackendId,
      idl: canisters.powBackend.idl,
      anon: true,
    });
    
    return await actor.get_miner_leaderboard(limit !== undefined ? [limit] : []);
  } catch (error) {
    console.error("Failed to get miner leaderboard", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to get miner leaderboard: ${JSON.stringify(error)}`);
  }
}

/**
 * Gets stats for a specific miner
 */
export async function getMinerStats(powBackendId: string, minerPrincipal: string): Promise<MinerInfo | null> {
  try {
    const actor = auth.pnp.getActor<CanisterType['POW_BACKEND']>({
      canisterId: powBackendId,
      idl: canisters.powBackend.idl,
      anon: true,
    });
    
    const principalObj = Principal.fromText(minerPrincipal);
    const result = await actor.get_miner_stats(principalObj);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("Failed to get miner stats", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to get miner stats: ${JSON.stringify(error)}`);
  }
}

/**
 * Gets current mining information
 */
export async function getMiningInfo(powBackendId: string): Promise<MiningInfo> {
  try {
    const actor = auth.pnp.getActor<CanisterType['POW_BACKEND']>({
      canisterId: powBackendId,
      idl: canisters.powBackend.idl,
      anon: true,
    });
    
    return await actor.get_mining_info();
  } catch (error) {
    console.error("Failed to get mining info", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to get mining info: ${JSON.stringify(error)}`);
  }
}

/**
 * Gets the current block template for mining
 */
export async function getCurrentBlock(powBackendId: string): Promise<BlockTemplate | null> {
  try {
    const actor = auth.pnp.getActor<CanisterType['POW_BACKEND']>({
      canisterId: powBackendId,
      idl: canisters.powBackend.idl,
      anon: true,
    });
    
    const result = await actor.get_current_block();
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("Failed to get current block", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to get current block: ${JSON.stringify(error)}`);
  }
}

/**
 * Gets the current mining difficulty
 */
export async function getMiningDifficulty(powBackendId: string): Promise<number> {
  try {
    const actor = auth.pnp.getActor<CanisterType['POW_BACKEND']>({
      canisterId: powBackendId,
      idl: canisters.powBackend.idl,
      anon: true,
    });
    
    return await actor.get_mining_difficulty();
  } catch (error) {
    console.error("Failed to get mining difficulty", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to get mining difficulty: ${JSON.stringify(error)}`);
  }
}

/**
 * Gets the current block height
 */
export async function getBlockHeight(powBackendId: string): Promise<bigint> {
  try {
    const actor = auth.pnp.getActor<CanisterType['POW_BACKEND']>({
      canisterId: powBackendId,
      idl: canisters.powBackend.idl,
      anon: true,
    });
    
    return await actor.get_block_height();
  } catch (error) {
    console.error("Failed to get block height", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to get block height: ${JSON.stringify(error)}`);
  }
}

/**
 * Gets the target block time
 */
export async function getBlockTimeTarget(powBackendId: string): Promise<bigint> {
  try {
    const actor = auth.pnp.getActor<CanisterType['POW_BACKEND']>({
      canisterId: powBackendId,
      idl: canisters.powBackend.idl,
      anon: true,
    });
    
    return await actor.get_block_time_target();
  } catch (error) {
    console.error("Failed to get block time target", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to get block time target: ${JSON.stringify(error)}`);
  }
}

/**
 * Gets the average block time
 */
export async function getAverageBlockTime(
  powBackendId: string, 
  blockCount?: bigint
): Promise<number> {
  try {
    const actor = auth.pnp.getActor<CanisterType['POW_BACKEND']>({
      canisterId: powBackendId,
      idl: canisters.powBackend.idl,
      anon: true,
    });
    
    const result = await actor.get_average_block_time(
      blockCount !== undefined ? [blockCount] : []
    );
    
    if ("Err" in result) {
      throw new Error(`Failed to get average block time: ${result.Err}`);
    }
    
    return result.Ok;
  } catch (error) {
    console.error("Failed to get average block time", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to get average block time: ${JSON.stringify(error)}`);
  }
}

/**
 * Gets the social links for the token
 */
export async function getSocialLinks(powBackendId: string): Promise<SocialLink[]> {
  try {
    const actor = auth.pnp.getActor<CanisterType['POW_BACKEND']>({
      canisterId: powBackendId,
      idl: canisters.powBackend.idl,
      anon: true,
    });
    
    const result = await actor.get_social_links();
    
    if ("Err" in result) {
      throw new Error(`Failed to get social links: ${result.Err}`);
    }
    
    return result.Ok;
  } catch (error) {
    console.error("Failed to get social links", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to get social links: ${JSON.stringify(error)}`);
  }
}

/**
 * Adds a social link to the token
 */
export async function addSocialLink(
  powBackendId: string, 
  platform: string, 
  url: string
): Promise<void> {
  try {
    const actor = auth.pnp.getActor<CanisterType['POW_BACKEND']>({
      canisterId: powBackendId,
      idl: canisters.powBackend.idl,
      anon: false,
      requiresSigning: false,
    });
    
    const result = await actor.add_social_link(platform, url);
    
    if ("Err" in result) {
      throw new Error(`Failed to add social link: ${result.Err}`);
    }
    
    notificationsStore.add({
      title: "Social Link Added",
      message: `${platform} social link has been added`,
      type: "success",
    });
  } catch (error) {
    console.error("Failed to add social link", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to add social link: ${JSON.stringify(error)}`);
  }
}

/**
 * Updates a social link
 */
export async function updateSocialLink(
  powBackendId: string, 
  index: bigint, 
  platform: string, 
  url: string
): Promise<void> {
  try {
    const actor = auth.pnp.getActor<CanisterType['POW_BACKEND']>({
      canisterId: powBackendId,
      idl: canisters.powBackend.idl,
      anon: false,
      requiresSigning: false,
    });
    
    const result = await actor.update_social_link(index, platform, url);
    
    if ("Err" in result) {
      throw new Error(`Failed to update social link: ${result.Err}`);
    }
    
    notificationsStore.add({
      title: "Social Link Updated",
      message: `${platform} social link has been updated`,
      type: "success",
    });
  } catch (error) {
    console.error("Failed to update social link", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to update social link: ${JSON.stringify(error)}`);
  }
}

/**
 * Removes a social link
 */
export async function removeSocialLink(powBackendId: string, index: bigint): Promise<void> {
  try {
    const actor = auth.pnp.getActor<CanisterType['POW_BACKEND']>({
      canisterId: powBackendId,
      idl: canisters.powBackend.idl,
      anon: false,
      requiresSigning: false,
    });
    
    const result = await actor.remove_social_link(index);
    
    if ("Err" in result) {
      throw new Error(`Failed to remove social link: ${result.Err}`);
    }
    
    notificationsStore.add({
      title: "Social Link Removed",
      message: "Social link has been removed",
      type: "success",
    });
  } catch (error) {
    console.error("Failed to remove social link", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to remove social link: ${JSON.stringify(error)}`);
  }
}

/**
 * Registers a miner with the token
 */
export async function registerMiner(powBackendId: string): Promise<void> {
  try {
    const actor = auth.pnp.getActor<CanisterType['POW_BACKEND']>({
      canisterId: powBackendId,
      idl: canisters.powBackend.idl,
      anon: false,
      requiresSigning: false,
    });
    
    const result = await actor.register_miner();
    
    if ("Err" in result) {
      throw new Error(`Failed to register miner: ${result.Err}`);
    }
    
    notificationsStore.add({
      title: "Miner Registered",
      message: "Your miner has been registered successfully",
      type: "success",
    });
  } catch (error) {
    console.error("Failed to register miner", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to register miner: ${JSON.stringify(error)}`);
  }
}

/**
 * Deregisters a miner from the token
 */
export async function deregisterMiner(powBackendId: string): Promise<void> {
  try {
    const actor = auth.pnp.getActor<CanisterType['POW_BACKEND']>({
      canisterId: powBackendId,
      idl: canisters.powBackend.idl,
      anon: false,
      requiresSigning: false,
    });
    
    const result = await actor.deregister_miner();
    
    if ("Err" in result) {
      throw new Error(`Failed to deregister miner: ${result.Err}`);
    }
    
    notificationsStore.add({
      title: "Miner Deregistered",
      message: "Your miner has been deregistered successfully",
      type: "success",
    });
  } catch (error) {
    console.error("Failed to deregister miner", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to deregister miner: ${JSON.stringify(error)}`);
  }
}

/**
 * Creates a genesis block for a token
 */
export async function createGenesisBlock(powBackendId: string): Promise<BlockTemplate> {
  try {
    const actor = auth.pnp.getActor<CanisterType['POW_BACKEND']>({
      canisterId: powBackendId,
      idl: canisters.powBackend.idl,
      anon: false,
      requiresSigning: false,
    });
    
    const result = await actor.create_genesis_block();
    
    if ("Err" in result) {
      throw new Error(`Failed to create genesis block: ${result.Err}`);
    }
    
    notificationsStore.add({
      title: "Genesis Block Created",
      message: "Genesis block has been created successfully",
      type: "success",
    });
    
    return result.Ok;
  } catch (error) {
    console.error("Failed to create genesis block", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to create genesis block: ${JSON.stringify(error)}`);
  }
}

/**
 * Starts the token
 */
export async function startToken(powBackendId: string): Promise<void> {
  try {
    const actor = auth.pnp.getActor<CanisterType['POW_BACKEND']>({
      canisterId: powBackendId,
      idl: canisters.powBackend.idl,
      anon: false,
      requiresSigning: false,
    });
    
    const result = await actor.start_token();
    
    if ("Err" in result) {
      throw new Error(`Failed to start token: ${result.Err}`);
    }
    
    notificationsStore.add({
      title: "Token Started",
      message: "Token has been started successfully",
      type: "success",
    });
  } catch (error) {
    console.error("Failed to start token", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to start token: ${JSON.stringify(error)}`);
  }
}

/**
 * Claims pending rewards
 */
export async function claimRewards(powBackendId: string): Promise<bigint> {
  try {
    const actor = auth.pnp.getActor<CanisterType['POW_BACKEND']>({
      canisterId: powBackendId,
      idl: canisters.powBackend.idl,
      anon: false,
      requiresSigning: false,
    });
    
    const result = await actor.claim_rewards();
    
    if ("Err" in result) {
      throw new Error(`Failed to claim rewards: ${result.Err}`);
    }
    
    notificationsStore.add({
      title: "Rewards Claimed",
      message: `You have claimed ${result.Ok.toString()} tokens`,
      type: "success",
    });
    
    return result.Ok;
  } catch (error) {
    console.error("Failed to claim rewards", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to claim rewards: ${JSON.stringify(error)}`);
  }
}

/**
 * Gets pending rewards
 */
export async function getPendingRewards(powBackendId: string): Promise<[Principal, bigint][]> {
  try {
    const actor = auth.pnp.getActor<CanisterType['POW_BACKEND']>({
      canisterId: powBackendId,
      idl: canisters.powBackend.idl,
      anon: true,
    });
    
    return await actor.get_pending_rewards();
  } catch (error) {
    console.error("Failed to get pending rewards", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to get pending rewards: ${JSON.stringify(error)}`);
  }
}

/**
 * Gets the list of all miners
 */
export async function getMiners(powBackendId: string): Promise<MinerInfo[]> {
  try {
    const actor = auth.pnp.getActor<CanisterType['POW_BACKEND']>({
      canisterId: powBackendId,
      idl: canisters.powBackend.idl,
      anon: true,
    });
    
    return await actor.get_miners();
  } catch (error) {
    console.error("Failed to get miners", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to get miners: ${JSON.stringify(error)}`);
  }
}

/**
 * Gets the metrics for the token
 */
export async function getMetrics(powBackendId: string): Promise<TokenMetrics> {
  try {
    const actor = auth.pnp.getActor<CanisterType['POW_BACKEND']>({
      canisterId: powBackendId,
      idl: canisters.powBackend.idl,
      anon: true,
    });
    
    const result = await actor.get_metrics();
    
    if ("Err" in result) {
      throw new Error(`Failed to get metrics: ${result.Err}`);
    }
    
    return result.Ok;
  } catch (error) {
    console.error("Failed to get metrics", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to get metrics: ${JSON.stringify(error)}`);
  }
}

/**
 * Submits a solution for mining
 */
export async function submitSolution(
  powBackendId: string,
  nonce: bigint,
  solutionHash: Uint8Array,
  minerId: string
): Promise<BlockTemplate> {
  try {
    const actor = auth.pnp.getActor<CanisterType['POW_BACKEND']>({
      canisterId: powBackendId,
      idl: canisters.powBackend.idl,
      anon: false,
      requiresSigning: false,
    });
    
    const minerPrincipal = Principal.fromText(minerId);
    const result = await actor.submit_solution(nonce, solutionHash, minerPrincipal);
    
    if ("Err" in result) {
      const errorType = Object.keys(result.Err)[0];
      if (errorType === "VerificationFailed") {
        throw new Error("Solution verification failed");
      } else if (errorType === "UnauthorizedMiner") {
        throw new Error("Unauthorized miner");
      } else if (errorType === "NoBlockToMine") {
        throw new Error("No block available to mine");
      } else if (errorType === "DuplicateSolution") {
        throw new Error("Duplicate solution");
      } else if (errorType === "StaleBlock") {
        throw new Error("Stale block");
      } else {
        throw new Error(`Failed to submit solution: ${JSON.stringify(result.Err)}`);
      }
    }
    
    notificationsStore.add({
      title: "Solution Submitted",
      message: "Mining solution has been submitted successfully",
      type: "success",
    });
    
    return result.Ok;
  } catch (error) {
    console.error("Failed to submit solution", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to submit solution: ${JSON.stringify(error)}`);
  }
}