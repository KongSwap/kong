import { canisters, type CanisterType } from "$lib/config/auth.config";
import { auth } from "$lib/stores/auth";
import { notificationsStore } from "$lib/stores/notificationsStore";
import { Principal } from "@dfinity/principal";
import type { ChainType, TokenInfo, MinerInfo } from "../../../../declarations/launchpad/launchpad.did.d.ts";

/**
 * Lists all tokens created with the launchpad
 */
export async function listTokens(): Promise<TokenInfo[]> {
  try {
    const actor = auth.pnp.getActor<CanisterType['LAUNCHPAD']>({
      canisterId: canisters.launchpad.canisterId,
      idl: canisters.launchpad.idl,
      anon: true,
    });
    const tokens = await actor.list_tokens();
    return tokens;
  } catch (error) {
    console.error("Failed to load tokens", error);
    throw error;
  }
}

/**
 * Lists all miners created with the launchpad
 */
export async function listMiners(): Promise<MinerInfo[]> {
  try {
    const actor = auth.pnp.getActor<CanisterType['LAUNCHPAD']>({
      canisterId: canisters.launchpad.canisterId,
      idl: canisters.launchpad.idl,
      anon: true,
    });
    const miners = await actor.list_miners();
    return miners;
  } catch (error) {
    console.error("Failed to load miners", error);
    throw error;
  }
}

/**
 * Creates a new token through the launchpad
 */
export async function createToken(
  name: string,
  ticker: string,
  totalSupply: bigint,
  logo?: string,
  decimals?: number,
  transferFee?: bigint,
  blockTimeTarget: bigint,
  halvingInterval: bigint,
  initialBlockReward: bigint,
  chain: ChainType,
  ledgerId?: Principal,
): Promise<Principal> {
  try {
    const actor = auth.pnp.getActor<CanisterType['LAUNCHPAD']>({
      canisterId: canisters.launchpad.canisterId,
      idl: canisters.launchpad.idl,
      anon: false,
      requiresSigning: false,
    });
    
    const result = await actor.create_token(
      name,
      ticker,
      totalSupply,
      logo ? [logo] : [],
      decimals !== undefined ? [decimals] : [],
      transferFee !== undefined ? [transferFee] : [],
      blockTimeTarget,
      halvingInterval,
      initialBlockReward,
      chain,
      ledgerId ? [ledgerId] : [],
    );
    
    if ("Err" in result) {
      throw new Error(`Failed to create token: ${result.Err}`);
    }
    
    notificationsStore.add({
      title: "Token Created",
      message: `Token "${name}" has been created`,
      type: "success",
    });
    
    return result.Ok;
  } catch (error) {
    console.error("Failed to create token", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to create token: ${JSON.stringify(error)}`);
  }
}

/**
 * Creates a new miner through the launchpad
 */
export async function createMiner(
  powBackendId: Principal,
  existingMinerId?: Principal
): Promise<Principal> {
  try {
    const actor = auth.pnp.getActor<CanisterType['LAUNCHPAD']>({
      canisterId: canisters.launchpad.canisterId,
      idl: canisters.launchpad.idl,
      anon: false,
      requiresSigning: false,
    });
    
    const result = await actor.create_miner(
      powBackendId,
      existingMinerId ? [existingMinerId] : [],
    );
    
    if ("Err" in result) {
      throw new Error(`Failed to create miner: ${result.Err}`);
    }
    
    notificationsStore.add({
      title: "Miner Created",
      message: "Your miner has been created successfully",
      type: "success",
    });
    
    return result.Ok;
  } catch (error) {
    console.error("Failed to create miner", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to create miner: ${JSON.stringify(error)}`);
  }
}

/**
 * Claims KONG tokens for creators
 */
export async function claimKong(amount: bigint): Promise<bigint> {
  try {
    const actor = auth.pnp.getActor<CanisterType['LAUNCHPAD']>({
      canisterId: canisters.launchpad.canisterId,
      idl: canisters.launchpad.idl,
      anon: false,
      requiresSigning: false,
    });
    
    const result = await actor.claim_kong(amount);
    
    if ("Err" in result) {
      throw new Error(`Failed to claim KONG: ${result.Err}`);
    }
    
    notificationsStore.add({
      title: "KONG Claimed",
      message: `You have claimed ${amount.toString()} KONG`,
      type: "success",
    });
    
    return result.Ok;
  } catch (error) {
    console.error("Failed to claim KONG", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to claim KONG: ${JSON.stringify(error)}`);
  }
}

/**
 * Gets a quote for topping up a miner with cycles
 */
export async function getTopUpQuote(cycles: bigint): Promise<bigint> {
  try {
    const actor = auth.pnp.getActor<CanisterType['LAUNCHPAD']>({
      canisterId: canisters.launchpad.canisterId,
      idl: canisters.launchpad.idl,
      anon: true,
    });
    
    const result = await actor.get_top_up_quote(cycles);
    
    if ("Err" in result) {
      throw new Error(`Failed to get top-up quote: ${result.Err}`);
    }
    
    return result.Ok;
  } catch (error) {
    console.error("Failed to get top-up quote", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to get top-up quote: ${JSON.stringify(error)}`);
  }
}

/**
 * Tops up a miner with cycles
 */
export async function topUpMiner(minerId: Principal, cycles: bigint): Promise<bigint> {
  try {
    const actor = auth.pnp.getActor<CanisterType['LAUNCHPAD']>({
      canisterId: canisters.launchpad.canisterId,
      idl: canisters.launchpad.idl,
      anon: false,
      requiresSigning: false,
    });
    
    const result = await actor.top_up_miner(minerId, cycles);
    
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

/**
 * Lists all trusted hashes
 */
export async function listTrustedHashes(): Promise<Uint8Array[]> {
  try {
    const actor = auth.pnp.getActor<CanisterType['LAUNCHPAD']>({
      canisterId: canisters.launchpad.canisterId,
      idl: canisters.launchpad.idl,
      anon: true,
    });
    
    const result = await actor.list_trusted_hashes();
    
    if ("Err" in result) {
      throw new Error(`Failed to list trusted hashes: ${result.Err}`);
    }
    
    return result.Ok;
  } catch (error) {
    console.error("Failed to list trusted hashes", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to list trusted hashes: ${JSON.stringify(error)}`);
  }
}

/**
 * Adds a trusted hash
 */
export async function addTrustedHash(hash: Uint8Array): Promise<void> {
  try {
    const actor = auth.pnp.getActor<CanisterType['LAUNCHPAD']>({
      canisterId: canisters.launchpad.canisterId,
      idl: canisters.launchpad.idl,
      anon: false,
      requiresSigning: false,
    });
    
    const result = await actor.add_trusted_hash(hash);
    
    if ("Err" in result) {
      throw new Error(`Failed to add trusted hash: ${result.Err}`);
    }
    
    notificationsStore.add({
      title: "Trusted Hash Added",
      message: "Trusted hash has been added successfully",
      type: "success",
    });
  } catch (error) {
    console.error("Failed to add trusted hash", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to add trusted hash: ${JSON.stringify(error)}`);
  }
}

/**
 * Removes a trusted hash
 */
export async function removeTrustedHash(hash: Uint8Array): Promise<boolean> {
  try {
    const actor = auth.pnp.getActor<CanisterType['LAUNCHPAD']>({
      canisterId: canisters.launchpad.canisterId,
      idl: canisters.launchpad.idl,
      anon: false,
      requiresSigning: false,
    });
    
    const result = await actor.remove_trusted_hash(hash);
    
    if ("Err" in result) {
      throw new Error(`Failed to remove trusted hash: ${result.Err}`);
    }
    
    notificationsStore.add({
      title: "Trusted Hash Removed",
      message: "Trusted hash has been removed successfully",
      type: "success",
    });
    
    return result.Ok;
  } catch (error) {
    console.error("Failed to remove trusted hash", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to remove trusted hash: ${JSON.stringify(error)}`);
  }
}

/**
 * Validates a hash
 */
export async function validateHash(hash: Uint8Array): Promise<boolean> {
  try {
    const actor = auth.pnp.getActor<CanisterType['LAUNCHPAD']>({
      canisterId: canisters.launchpad.canisterId,
      idl: canisters.launchpad.idl,
      anon: true,
    });
    
    return await actor.validate_hash(hash);
  } catch (error) {
    console.error("Failed to validate hash", error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to validate hash: ${JSON.stringify(error)}`);
  }
}