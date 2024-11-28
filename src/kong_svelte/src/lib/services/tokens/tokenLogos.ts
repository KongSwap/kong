import { kongDB } from '../db';
import { ICP_CANISTER_ID } from '$lib/constants/canisterConstants';
import { writable, get } from 'svelte/store';
import { getTokenMetadata } from './tokenUtils';

export const IMAGE_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Define a type for logo URLs
export type TokenLogoUrl = string;

export const DEFAULT_LOGOS = {
  [ICP_CANISTER_ID]: '/tokens/icp.webp',
  DEFAULT: '/tokens/not_verified.webp'
} as const;

export const tokenLogoStore = writable<Record<string, TokenLogoUrl>>({
  ...DEFAULT_LOGOS
});

let loadingPromises: Record<string, Promise<string>> = {};

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
    console.log('Getting logo for canister:', canister_id);
    
    // First check if it's a default logo
    if (canister_id in DEFAULT_LOGOS) {
      return DEFAULT_LOGOS[canister_id as keyof typeof DEFAULT_LOGOS];
    }

    // Query by canister_id using equals instead of get
    const image = await kongDB.images
      .where('canister_id')
      .equals(canister_id)
      .first();

    if (!image) {
      return await fetchTokenLogo(canister_id);
    }

    // Check if the logo is older than 24 hours
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (!image.timestamp || Date.now() - image.timestamp > ONE_DAY) {
      console.log('Logo expired for:', canister_id);
      // Logo is too old, delete it and refetch
      await kongDB.images
        .where('canister_id')
        .equals(canister_id)
        .delete();
      return await fetchTokenLogo(canister_id);
    }

    console.log('Returning cached logo for:', canister_id);
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

    // Update store with all valid images
    tokenLogoStore.update(logos => ({
      ...logos,
      ...result
    }));

    // Clean up expired entries
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
    
    // First get all cached images
    const cachedImages = await kongDB.images
      .where('timestamp')
      .above(currentTime - IMAGE_CACHE_DURATION)
      .toArray();
    
    // Create a map of cached canister IDs
    const cachedCanisterIds = new Set(cachedImages.map(img => img.canister_id));
    
    // For tokens without cached logos, fetch them
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
      timestamp: Date.now(), // Reset timestamp on update
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

export async function fetchTokenLogo(canister_id: string): Promise<TokenLogoUrl> {  
  try {
    if (!canister_id) {
      console.debug('No canister_id provided');
      return DEFAULT_LOGOS.DEFAULT;
    }

    // Check if we already have a loading promise for this canister
    if (loadingPromises[canister_id]) {
      console.log('Using existing loading promise for:', canister_id);
      return await loadingPromises[canister_id];
    }

    // Create new loading promise
    loadingPromises[canister_id] = (async () => {
      try {
        const metadata = await getTokenMetadata(canister_id);

        // Try all possible logo keys
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
          return DEFAULT_LOGOS.DEFAULT;
        }

        const [_, value] = logoEntry;
        let logoUrl: TokenLogoUrl = DEFAULT_LOGOS.DEFAULT;

        if ('Text' in value && value.Text) {
          logoUrl = value.Text as TokenLogoUrl;
        } else if ('Blob' in value && value.Blob) {
          const base64 = btoa(String.fromCharCode(...value.Blob));
          logoUrl = `data:image/png;base64,${base64}` as TokenLogoUrl;
        }

        // Save to DB and store
        await saveTokenLogo(canister_id, logoUrl);
        tokenLogoStore.update(logos => ({
          ...logos,
          [canister_id]: logoUrl
        }));

        return logoUrl;
      } finally {
        delete loadingPromises[canister_id];
      }
    })();

    return await loadingPromises[canister_id];
  } catch (error) {
    console.error('Error in fetchTokenLogo:', error);
    return DEFAULT_LOGOS.DEFAULT;
  }
}