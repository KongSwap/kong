// Canister IDs for major tokens
import {
  ICP_CANISTER_ID,
} from "$lib/constants/canisterConstants";

// Canister IDs for community tokens
import {
  GHOST_CANISTER_ID,
  KINIC_CANISTER_ID,
  CHAT_CANISTER_ID,
  CTZ_CANISTER_ID,
  DOLR_CANISTER_ID,
} from "$lib/constants/canisterConstants";

// System and configuration constants
import {
  INDEXER_URL,
  KONG_BACKEND_PRINCIPAL,
  DFX_VERSION,
  DFX_NETWORK,
  KONG_FRONTEND_CANISTER_ID,
  KONG_SVELTE_CANISTER_ID,
  KONG_BACKEND_CANISTER_ID,
} from "$lib/constants/canisterConstants";

import { kongDB } from '../db';
import { writable } from 'svelte/store';
import { getTokenMetadata } from './tokenUtils';

// The cache duration for images.
export const IMAGE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// The static assets URL.
const STATIC_ASSETS_URL = `${INDEXER_URL}`;

// We are adding the yral token's logo to the DEFAULT_LOGOS map. 
// This token's name is "yral" and ticker is "DOLR", and we know its canister ID is DOLR_CANISTER_ID.
// We map DOLR_CANISTER_ID to the yral_logo.png image.
export const DEFAULT_LOGOS = {
  [ICP_CANISTER_ID]: '/tokens/icp.webp',
  [GHOST_CANISTER_ID]: '/tokens/ghost_logo.png',
  [KINIC_CANISTER_ID]: '/tokens/kinic_logo.png',
  [CHAT_CANISTER_ID]: '/tokens/openchat_logo.png',
  [CTZ_CANISTER_ID]: '/tokens/catalyze_logo.png',
  [DOLR_CANISTER_ID]: '/tokens/yral_logo.png', // The yral token with DOLR as ticker
  DEFAULT: '/tokens/not_verified.webp'
} as const;

// Initialize the tokenLogoStore with the default logos.
export const tokenLogoStore = writable<Record<string, string>>({
  ...DEFAULT_LOGOS
});

let loadingPromises: Record<string, Promise<string>> = {};
const failedLogoAttempts = new Set<string>();

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

    const image = await kongDB.images
      .where('canister_id')
      .equals(canister_id)
      .first();

    if (!image) {
      return await fetchTokenLogo(canister_id);
    }

    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (!image.timestamp || Date.now() - image.timestamp > ONE_DAY) {
      console.log('Logo expired for:', canister_id);
      await kongDB.images
        .where('canister_id')
        .equals(canister_id)
        .delete();
      return await fetchTokenLogo(canister_id);
    }

    return image.image_url || DEFAULT_LOGOS.DEFAULT;
  } catch (error) {
    console.error('Error getting token logo:', error);
    return DEFAULT_LOGOS.DEFAULT;
  }
}

export async function getTokenLogoById(id: number): Promise<any | null> {
  try {
    const image = await kongDB.images.get(id);
    if (image && Date.now() - image.timestamp < IMAGE_CACHE_DURATION) {
      return image;
    }
    return null;
  } catch (error) {
    console.error('Error getting image by id:', error);
    return null;
  }
}

export async function bulkSaveTokenLogos(
  images: Array<{ canister_id: string; image_url: string }>
): Promise<void> {
  try {
    await kongDB.transaction('rw', kongDB.images, async () => {
      const timestamp = Date.now();
      const entries = images.map(img => ({
        canister_id: img.canister_id,
        image_url: img.image_url,
        timestamp
      }));
      await kongDB.images.bulkAdd(entries);
    });
  } catch (error) {
    console.error('Error bulk saving images:', error);
  }
}

export async function getMultipleTokenLogos(canister_ids: string[]): Promise<Record<string, string>> {
  try {
    const currentTime = Date.now();
    const validImages = await kongDB.images
      .where('canister_id')
      .anyOf(canister_ids)
      .and(image => currentTime - image.timestamp < IMAGE_CACHE_DURATION)
      .toArray();

    const result: Record<string, string> = {};
    validImages.forEach(img => {
      result[img.canister_id] = img.image_url;
    });

    tokenLogoStore.update(logos => ({
      ...logos,
      ...result
    }));

    const foundIds = new Set(validImages.map(img => img.canister_id));
    const expiredIds = canister_ids.filter(id => !foundIds.has(id));
    
    if (expiredIds.length > 0) {
      await kongDB.images
        .where('canister_id')
        .anyOf(expiredIds)
        .delete();
    }

    return result;
  } catch (error) {
    console.error('Error getting multiple images:', error);
    return {};
  }
}

export async function getAllTokenLogos(tokens: any[]): Promise<any[]> {
  try {
    const currentTime = Date.now();
    const cachedImages = await kongDB.images
      .where('timestamp')
      .above(currentTime - IMAGE_CACHE_DURATION)
      .toArray();

    const cachedCanisterIds = new Set(cachedImages.map(img => img.canister_id));

    const fetchPromises = tokens
      .filter(token => !cachedCanisterIds.has(token.canister_id))
      .map(async token => {
        try {
          const image_url = await fetchTokenLogo(token.canister_id);
          const newImage = {
            canister_id: token.canister_id,
            image_url,
            timestamp: Date.now()
          };
          await saveTokenLogo(token.canister_id, image_url);
          return newImage;
        } catch (error) {
          console.error(`Error fetching logo for token ${token.canister_id}:`, error);
          return null;
        }
      });

    const fetchedImages = (await Promise.all(fetchPromises)).filter((img): img is any => 
      img !== null 
    );
    
    return [...cachedImages, ...fetchedImages];
  } catch (error) {
    console.error('Error getting all images:', error);
    return [];
  }
}

export async function deleteTokenLogo(id: number): Promise<void> {
  try {
    await kongDB.images.delete(id);
  } catch (error) {
    console.error('Error deleting image:', error);
    throw error;
  }
}

export async function updateTokenLogo(
  id: number, 
  updates: any
): Promise<number> {
  try {
    const image = await kongDB.images.get(id);
    if (!image) {
      throw new Error('Image not found');
    }

    const updatedImage = {
      ...image,
      ...updates,
      timestamp: Date.now()
    };

    return await kongDB.images.put(updatedImage);
  } catch (error) {
    console.error('Error updating image:', error);
    throw error;
  }
}

export async function cleanupExpiredTokenLogos(): Promise<void> {
  try {
    const expirationTime = Date.now() - IMAGE_CACHE_DURATION;
    await kongDB.transaction('rw', kongDB.images, async () => {
      await kongDB.images
        .where('timestamp')
        .below(expirationTime)
        .delete();
    });
  } catch (error) {
    console.error('Error cleaning up expired images:', error);
  }
}

export async function fetchTokenLogo(canister_id: string): Promise<string> {
  try {
    if (!canister_id) {
      console.debug('No canister_id provided');
      return DEFAULT_LOGOS.DEFAULT;
    }

    if (loadingPromises[canister_id]) {
      try {
        return await loadingPromises[canister_id];
      } catch (error) {
        console.warn('Existing promise failed, creating new one:', error);
        delete loadingPromises[canister_id];
      }
    }

    const promise = (async () => {
      try {
        const metadata = await getTokenMetadata(canister_id);
        const logoKeys = ['icrc1:logo', 'icrc1:icrc1_logo', 'logo', 'icrc1_logo'];
        let logoEntry = null;
        
        for (const key of logoKeys) {
          const entry = metadata.find(([k]) => k === key);
          if (entry) {
            logoEntry = entry;
            console.log('Found logo entry with key:', key);
            break;
          }
        }

        if (!logoEntry) {
          return canister_id in DEFAULT_LOGOS ? DEFAULT_LOGOS[canister_id as keyof typeof DEFAULT_LOGOS] : DEFAULT_LOGOS.DEFAULT;
        }

        const [_, value] = logoEntry;
        let logoUrl: string = DEFAULT_LOGOS.DEFAULT;

        if ('Text' in value && value.Text) {
          // Handle both relative and absolute URLs
          const urlText = value.Text;
          if (urlText.startsWith('http://') || urlText.startsWith('https://') || urlText.startsWith('data:')) {
            // Absolute URL or data URL - use as is
            logoUrl = urlText;
          } else if (urlText.startsWith('/')) {
            // Relative URL starting with / - prepend STATIC_ASSETS_URL
            logoUrl = `${STATIC_ASSETS_URL}${urlText}`;
          } else {
            // Relative URL without leading / - prepend STATIC_ASSETS_URL with /
            logoUrl = `${STATIC_ASSETS_URL}/${urlText}`;
          }
        } else if ('Blob' in value && value.Blob) {
          const base64 = btoa(String.fromCharCode(...value.Blob));
          logoUrl = `data:image/png;base64,${base64}`;
        }

        console.log(`Logo URL for ${canister_id}:`, logoUrl);
        
        await saveTokenLogo(canister_id, logoUrl);
        tokenLogoStore.update(logos => ({
          ...logos,
          [canister_id]: logoUrl
        }));

        return logoUrl;
      } catch (error) {
        console.error('Error in fetchTokenLogo:', error);
        return canister_id in DEFAULT_LOGOS ? DEFAULT_LOGOS[canister_id as keyof typeof DEFAULT_LOGOS] : DEFAULT_LOGOS.DEFAULT;
      }
    })();

    loadingPromises[canister_id] = promise;
    
    try {
      return await promise;
    } finally {
      if (loadingPromises[canister_id] === promise) {
        delete loadingPromises[canister_id];
      }
    }
  } catch (error) {
    console.error('Error in fetchTokenLogo:', error);
    return canister_id in DEFAULT_LOGOS ? DEFAULT_LOGOS[canister_id as keyof typeof DEFAULT_LOGOS] : DEFAULT_LOGOS.DEFAULT;
  }
}

// The parseTokens function now ensures that if the token is the yral token (with DOLR ticker)
// we apply the fallback logic just as we do for ICP and other known hardcoded tokens.
export const parseTokens = (
  data: FE.Token[],
): FE.Token[] => {
  try {
    const icTokens: FE.Token[] = data.map((token) => {
      let logoUrl = token?.logo_url 
        ? `${STATIC_ASSETS_URL}${token.logo_url}`
        : DEFAULT_LOGOS.DEFAULT;

      // If the token is ICP
      if (token.canister_id === ICP_CANISTER_ID) {
        logoUrl = DEFAULT_LOGOS[ICP_CANISTER_ID];
      }
      // If the token is Ghost
      else if (token.canister_id === GHOST_CANISTER_ID) {
        logoUrl = DEFAULT_LOGOS[GHOST_CANISTER_ID];
      }
      // If the token is Kinic
      else if (token.canister_id === KINIC_CANISTER_ID) {
        logoUrl = DEFAULT_LOGOS[KINIC_CANISTER_ID];
      }
      // If the token is Openchat
      else if (token.canister_id === CHAT_CANISTER_ID) {
        logoUrl = DEFAULT_LOGOS[CHAT_CANISTER_ID];
      }
      // If the token is Catalyze
      else if (token.canister_id === CTZ_CANISTER_ID) {
        logoUrl = DEFAULT_LOGOS[CTZ_CANISTER_ID];
      }
      // If the token is yral with DOLR as ticker
      else if (token.canister_id === DOLR_CANISTER_ID) {
        logoUrl = DEFAULT_LOGOS[DOLR_CANISTER_ID];
      }

      const result: FE.Token = {
        ...token,
        logo_url: logoUrl,
      };

      return result;
    });

    return icTokens;
  } catch (error) {
    console.error('Error parsing tokens:', error);
    return [];
  }
};
