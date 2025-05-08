import { canisters, type CanisterType } from "$lib/config/auth.config";
import { auth } from "$lib/stores/auth";
import { notificationsStore } from "$lib/stores/notificationsStore";
import { Principal } from "@dfinity/principal";
import type { 
  BlockTemplate,
  MinerInfo, 
  MiningStats, 
  MiningResult 
} from "../../../../declarations/miner/miner.did.d.ts";

/**
 * Gets information about a miner
 */
export async function getMinerInfo(minerId: string): Promise<MinerInfo> {
  try {
    const actor = auth.pnp.getActor<CanisterType['MINER']>({
      canisterId: minerId,
      idl: canisters.miner.idl,
      anon: true,
    });
    
    const result = await actor.get_info();
    
    if ("Err" in result) {
      throw new Error(`Failed to get miner info: ${result.Err}`);
    }
    
    return result.Ok;
  } catch (error) {
    console.error("Failed to get miner info", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to get miner info: ${JSON.stringify(error)}`);
  }
}

/**
 * Gets mining statistics for a miner
 */
export async function getMiningStats(minerId: string): Promise<MiningStats> {
  try {
    const actor = auth.pnp.getActor<CanisterType['MINER']>({
      canisterId: minerId,
      idl: canisters.miner.idl,
      anon: true,
    });
    
    return await actor.get_mining_stats();
  } catch (error) {
    console.error("Failed to get mining stats", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to get mining stats: ${JSON.stringify(error)}`);
  }
}

/**
 * Starts mining with the miner
 */
export async function startMining(minerId: string): Promise<void> {
  try {
    const actor = auth.pnp.getActor<CanisterType['MINER']>({
      canisterId: minerId,
      idl: canisters.miner.idl,
      anon: false,
      requiresSigning: false,
    });
    
    const result = await actor.start_mining();
    
    if ("Err" in result) {
      throw new Error(`Failed to start mining: ${result.Err}`);
    }
    
    notificationsStore.add({
      title: "Mining Started",
      message: "Your miner has started mining",
      type: "success",
    });
  } catch (error) {
    console.error("Failed to start mining", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to start mining: ${JSON.stringify(error)}`);
  }
}

/**
 * Stops mining with the miner
 */
export async function stopMining(minerId: string): Promise<void> {
  try {
    const actor = auth.pnp.getActor<CanisterType['MINER']>({
      canisterId: minerId,
      idl: canisters.miner.idl,
      anon: false,
      requiresSigning: false,
    });
    
    const result = await actor.stop_mining();
    
    if ("Err" in result) {
      throw new Error(`Failed to stop mining: ${result.Err}`);
    }
    
    notificationsStore.add({
      title: "Mining Stopped",
      message: "Your miner has stopped mining",
      type: "success",
    });
  } catch (error) {
    console.error("Failed to stop mining", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to stop mining: ${JSON.stringify(error)}`);
  }
}

/**
 * Connects a token to the miner
 */
export async function connectToken(minerId: string, tokenId: string): Promise<void> {
  try {
    const actor = auth.pnp.getActor<CanisterType['MINER']>({
      canisterId: minerId,
      idl: canisters.miner.idl,
      anon: false,
      requiresSigning: false,
    });
    
    const tokenPrincipal = Principal.fromText(tokenId);
    const result = await actor.connect_token(tokenPrincipal);
    
    if ("Err" in result) {
      throw new Error(`Failed to connect token: ${result.Err}`);
    }
    
    notificationsStore.add({
      title: "Token Connected",
      message: "Token has been connected to your miner",
      type: "success",
    });
  } catch (error) {
    console.error("Failed to connect token", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to connect token: ${JSON.stringify(error)}`);
  }
}

/**
 * Disconnects the current token from the miner
 */
export async function disconnectToken(minerId: string): Promise<void> {
  try {
    const actor = auth.pnp.getActor<CanisterType['MINER']>({
      canisterId: minerId,
      idl: canisters.miner.idl,
      anon: false,
      requiresSigning: false,
    });
    
    const result = await actor.disconnect_token();
    
    if ("Err" in result) {
      throw new Error(`Failed to disconnect token: ${result.Err}`);
    }
    
    notificationsStore.add({
      title: "Token Disconnected",
      message: "Token has been disconnected from your miner",
      type: "success",
    });
  } catch (error) {
    console.error("Failed to disconnect token", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to disconnect token: ${JSON.stringify(error)}`);
  }
}

/**
 * Sets the mining speed
 */
export async function setMiningSpeed(minerId: string, speedPercentage: number): Promise<void> {
  try {
    const actor = auth.pnp.getActor<CanisterType['MINER']>({
      canisterId: minerId,
      idl: canisters.miner.idl,
      anon: false,
      requiresSigning: false,
    });
    
    const result = await actor.set_mining_speed(speedPercentage);
    
    if ("Err" in result) {
      throw new Error(`Failed to set mining speed: ${result.Err}`);
    }
    
    notificationsStore.add({
      title: "Mining Speed Updated",
      message: `Mining speed has been set to ${speedPercentage}%`,
      type: "success",
    });
  } catch (error) {
    console.error("Failed to set mining speed", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to set mining speed: ${JSON.stringify(error)}`);
  }
}

/**
 * Sets the chunk size for mining
 */
export async function setChunkSize(minerId: string, chunkSize: bigint): Promise<void> {
  try {
    const actor = auth.pnp.getActor<CanisterType['MINER']>({
      canisterId: minerId,
      idl: canisters.miner.idl,
      anon: false,
      requiresSigning: false,
    });
    
    const result = await actor.set_chunk_size(chunkSize);
    
    if ("Err" in result) {
      throw new Error(`Failed to set chunk size: ${result.Err}`);
    }
    
    notificationsStore.add({
      title: "Chunk Size Updated",
      message: `Chunk size has been set to ${chunkSize.toString()}`,
      type: "success",
    });
  } catch (error) {
    console.error("Failed to set chunk size", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to set chunk size: ${JSON.stringify(error)}`);
  }
}

/**
 * Claims mining rewards
 */
export async function claimRewards(minerId: string): Promise<bigint> {
  try {
    const actor = auth.pnp.getActor<CanisterType['MINER']>({
      canisterId: minerId,
      idl: canisters.miner.idl,
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
 * Gets the remaining hashes for the miner
 */
export async function getRemainingHashes(minerId: string): Promise<bigint> {
  try {
    const actor = auth.pnp.getActor<CanisterType['MINER']>({
      canisterId: minerId,
      idl: canisters.miner.idl,
      anon: true,
    });
    
    return await actor.get_remaining_hashes();
  } catch (error) {
    console.error("Failed to get remaining hashes", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to get remaining hashes: ${JSON.stringify(error)}`);
  }
}

/**
 * Gets the estimated time remaining for the current mining operation
 */
export async function getTimeRemainingEstimate(minerId: string): Promise<string> {
  try {
    const actor = auth.pnp.getActor<CanisterType['MINER']>({
      canisterId: minerId,
      idl: canisters.miner.idl,
      anon: true,
    });
    
    return await actor.get_time_remaining_estimate();
  } catch (error) {
    console.error("Failed to get time remaining estimate", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to get time remaining estimate: ${JSON.stringify(error)}`);
  }
}

/**
 * Finds a solution in a specified range
 */
export async function findSolutionInRange(
  minerId: string,
  blockTemplate: BlockTemplate,
  startNonce: bigint,
  endNonce: bigint
): Promise<MiningResult | null> {
  try {
    const actor = auth.pnp.getActor<CanisterType['MINER']>({
      canisterId: minerId,
      idl: canisters.miner.idl,
      anon: false,
      requiresSigning: false,
    });
    
    const result = await actor.find_solution_in_range(blockTemplate, startNonce, endNonce);
    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error("Failed to find solution in range", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to find solution in range: ${JSON.stringify(error)}`);
  }
}

/**
 * Tops up the miner with cycles
 */
export async function topUpMiner(minerId: string, cycles: bigint): Promise<bigint> {
  try {
    const actor = auth.pnp.getActor<CanisterType['MINER']>({
      canisterId: minerId,
      idl: canisters.miner.idl,
      anon: false,
      requiresSigning: false,
    });
    
    const result = await actor.top_up(cycles);
    
    if ("Err" in result) {
      throw new Error(`Failed to top up miner: ${result.Err}`);
    }
    
    notificationsStore.add({
      title: "Miner Topped Up",
      message: `Your miner has been topped up with ${cycles.toString()} cycles`,
      type: "success",
    });
    
    return result.Ok;
  } catch (error) {
    console.error("Failed to top up miner", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to top up miner: ${JSON.stringify(error)}`);
  }
}