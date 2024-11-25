import { createAnonymousActorHelper } from "$lib/utils/actorUtils";
import { canisterIDLs } from "../pnp/PnpInitializer";

export async function createTokenActor(canisterId: string) {
  try {
    const actor = await createAnonymousActorHelper(canisterId, canisterIDLs.icrc1);
    if (!actor) {
      throw new Error('Failed to create actor');
    }
    return actor;
  } catch (error) {
    console.error('Error creating token actor:', error);
    throw error;
  }
}

export async function getTokenMetadata(canisterId: string) {
  const actor = await createTokenActor(canisterId);
  return actor.icrc1_metadata();
}
