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
  DOLR_CANISTER_ID,
  CLOUD_CANISTER_ID,
  ICS_CANISTER_ID,
} from "$lib/constants/canisterConstants";
import { kongDB } from '../db';
import { writable } from 'svelte/store';

// The static assets URL.
export const DEFAULT_LOGOS = {
  [ICP_CANISTER_ID]: '/tokens/icp.webp',
  [GHOST_CANISTER_ID]: '/tokens/ghost_logo.png',
  [KINIC_CANISTER_ID]: '/tokens/kinic_logo.png',
  [CHAT_CANISTER_ID]: '/tokens/openchat_logo.png',
  [CTZ_CANISTER_ID]: '/tokens/catalyze_logo.png',
  [DOLR_CANISTER_ID]: '/tokens/yral_logo.png', // The yral token with DOLR as ticker
  [CLOUD_CANISTER_ID]: '/tokens/cloud_logo.png',
  [ICS_CANISTER_ID]: '/tokens/ics_logo.png',
  [BIL_CANISTER_ID]: '/tokens/bil_logo.webp',
  DEFAULT: '/tokens/not_verified.webp'
} as const;

// Initialize the tokenLogoStore with the default logos.
export const tokenLogoStore = writable<Record<string, string>>({
  ...DEFAULT_LOGOS
});

export async function saveTokenLogo(canister_id: string, image_url: string): Promise<void> {
  try {
    await kongDB.images.put({
      canister_id,
      image_url,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error saving token logo:', error);
  }
}

export async function getTokenLogo(canister_id: string): Promise<string> {
  try {    
    // Check if it is a default logo, including the new yral token.
    if (canister_id in DEFAULT_LOGOS) {
      return DEFAULT_LOGOS[canister_id as keyof typeof DEFAULT_LOGOS];
    }

    const token = await kongDB.tokens
      .where('canister_id')
      .equals(canister_id)
      .first();

    return token?.logo_url || DEFAULT_LOGOS.DEFAULT;
  } catch (error) {
    console.error('Error getting token logo:', error);
    return DEFAULT_LOGOS.DEFAULT;
  }
}
