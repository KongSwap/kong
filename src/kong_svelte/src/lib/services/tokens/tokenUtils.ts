import { createAnonymousActorHelper } from "$lib/utils/actorUtils";
import { canisterIDLs } from "../pnp/PnpInitializer";
import type { ActorMethod } from '@dfinity/agent';
import { auth } from '../auth';

// Helper function to handle BigInt serialization
function replaceBigInts(obj: any): any {
  if (typeof obj === 'bigint') {
    return obj.toString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(replaceBigInts);
  }
  
  if (typeof obj === 'object' && obj !== null) {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [key, replaceBigInts(value)])
    );
  }
  
  return obj;
}

// Create a custom transform for actor methods
function createBigIntTransform() {
  return {
    accept(value: any) {
      return typeof value === 'bigint';
    },
    transform(value: bigint) {
      return value.toString();
    }
  };
}

export async function getTokenMetadata(canisterId: string): Promise<Array<[string, any]>> {
  try {
    // Create actor with BigInt transform
    const actor = await auth.getActor(canisterId, canisterIDLs.icrc1, { 
      anon: true,
      requiresSigning: false
    });

    if (!actor || !('icrc1_metadata' in actor)) {
      throw new Error('Actor does not support icrc1_metadata');
    }

    const rawMetadata = await (actor.icrc1_metadata as ActorMethod)();
    
    // Process any remaining BigInts that weren't caught by the transform
    return replaceBigInts(rawMetadata);
  } catch (error) {
    console.error('Error fetching token metadata:', error);
    return [];
  }
}

// Helper function to create token actor with BigInt handling
export async function createTokenActor(canisterId: string) {
  try {
    const actor = await auth.getActor(
      canisterId, 
      canisterIDLs.icrc1,
      { anon: true, requiresSigning: false }
    );
    
    if (!actor) {
      throw new Error('Failed to create actor');
    }
    return actor;
  } catch (error) {
    console.error('Error creating token actor:', error);
    throw error;
  }
}
