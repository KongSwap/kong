// Canister IDs for major tokens
import {
  BIL_CANISTER_ID,
  ICP_CANISTER_ID,
} from "$lib/constants/canisterConstants";

// Canister IDs for community tokens
import {
  GHOST_CANISTER_ID,
  KINIC_CANISTER_ID,
  CHAT_CANISTER_ID,
  CTZ_CANISTER_ID,
  ICS_CANISTER_ID,
} from "$lib/constants/canisterConstants";
import { userTokens } from "$lib/stores/userTokens";
import { get } from 'svelte/store';

// The static assets URL.
export const DEFAULT_LOGOS = {
  [ICP_CANISTER_ID]: '/tokens/icp.webp',
  [GHOST_CANISTER_ID]: '/tokens/ghost_logo.png',
  [KINIC_CANISTER_ID]: '/tokens/kinic_logo.png',
  [CHAT_CANISTER_ID]: '/tokens/openchat_logo.png',
  [CTZ_CANISTER_ID]: '/tokens/catalyze_logo.png',
  [ICS_CANISTER_ID]: '/tokens/ics_logo.png',
  [BIL_CANISTER_ID]: '/tokens/bil_logo.webp',
  DEFAULT: '/tokens/not_verified.webp',
  null: '/tokens/not_verified.webp'
} as const;

export async function getTokenLogo(canister_id: string): Promise<string> {
  try {    
    if (canister_id in DEFAULT_LOGOS) {
      return DEFAULT_LOGOS[canister_id as keyof typeof DEFAULT_LOGOS];
    }

    const token = get(userTokens).tokens.find(t => t.canister_id === canister_id);

    return token?.logo_url || DEFAULT_LOGOS.DEFAULT;
  } catch (error) {
    console.error('Error getting token logo:', error);
    return DEFAULT_LOGOS.DEFAULT;
  }
}
