import { kongDB } from '../db';
import { ICP_CANISTER_ID } from '$lib/constants/canisterConstants';
import { createAnonymousActorHelper } from '$lib/utils/actorUtils';
import { canisterIDLs } from '$lib/services/pnp/PnpInitializer';
import { writable, get } from 'svelte/store';
import type { KongImage } from './types';

export const IMAGE_CACHE_DURATION = 1 * 60 * 60 * 1000; // 1 hour
export const DEFAULT_LOGOS = {
  [ICP_CANISTER_ID]: '/tokens/icp.webp',
  DEFAULT: '/tokens/not_verified.webp'
} as const;
export const tokenLogoStore = writable<Record<string, string>>(DEFAULT_LOGOS);

export async function saveTokenLogo(canister_id: string, image_url: string): Promise<void> {
  try {
    await kongDB.transaction('rw', kongDB.images, async () => {
      await kongDB.images.add({
        canister_id,
        image_url,
        timestamp: Date.now(),
      });
      // Update store
      tokenLogoStore.update(logos => ({
        ...logos,
        [canister_id]: image_url
      }));
    });
  } catch (error) {
    console.error('Error saving image to DB:', error);
  }
}

export async function getTokenLogo(canister_id: string): Promise<string | null> {
  try {
    // Check store first
    const storeLogos = get(tokenLogoStore);
    if (storeLogos[canister_id]) {
      return storeLogos[canister_id];
    }

    const currentTime = Date.now();
    const validImage = await kongDB.images
      .where('canister_id')
      .equals(canister_id)
      .and(image => currentTime - image.timestamp < IMAGE_CACHE_DURATION)
      .first();

    if (validImage) {
      // Update store
      tokenLogoStore.update(logos => ({
        ...logos,
        [canister_id]: validImage.image_url
      }));
      return validImage.image_url;
    }

    // Clean up expired entry if it exists
    await kongDB.images
      .where('canister_id')
      .equals(canister_id)
      .delete();

    return null;
  } catch (error) {
    console.error('Error getting image from DB:', error);
    return null;
  }
}

export async function getTokenLogoById(id: number): Promise<KongImage | null> {
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

export async function getAllTokenLogos(): Promise<KongImage[]> {
  try {
    const currentTime = Date.now();
    return await kongDB.images
      .where('timestamp')
      .above(currentTime - IMAGE_CACHE_DURATION)
      .toArray();
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
  updates: Partial<Omit<KongImage, 'id'>>
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

export async function fetchTokenLogo(token: FE.Token): Promise<string> {
  try {
    // Check default logos first
    if (token.canister_id === ICP_CANISTER_ID) {
      return DEFAULT_LOGOS[ICP_CANISTER_ID];
    }

    // Check store first
    const storeLogos = get(tokenLogoStore);
    if (storeLogos[token.canister_id]) {
      return storeLogos[token.canister_id];
    }

    // Then check DB cache
    const cachedLogo = await getTokenLogo(token.canister_id);
    if (cachedLogo) {
      return cachedLogo;
    }

    // If all else fails, fetch from backend
    try {
      const actor = await createAnonymousActorHelper(token.canister_id, canisterIDLs.icrc1);
      const metadata: Array<[string, { Text?: string; Blob?: Uint8Array }]> = await actor.icrc1_metadata();
      // First try icrc1:logo
      let logoResult = metadata.find(([key]) => key === 'icrc1:logo' || key === 'icrc1:icrc1_logo');
    
      // If not found, try logo
      if (!logoResult) {
        logoResult = metadata.find(([key]) => key === 'logo');
      }
      
      if (logoResult) {
        const [_, value] = logoResult;        
        if ('Text' in value && value.Text) {
          // Handle base64 images
          if (value.Text.startsWith('data:image/')) {
            await saveTokenLogo(token.canister_id, value.Text);
            return value.Text;
          }
          
          await saveTokenLogo(token.canister_id, value.Text);
          return value.Text;
        } else if ('Blob' in value && value.Blob) {
          // Convert Blob to base64
          const base64 = btoa(String.fromCharCode(...value.Blob));
          const mimeType = 'image/png'; // Assume PNG for blob data
          const dataUrl = `data:${mimeType};base64,${base64}`;
          await saveTokenLogo(token.canister_id, dataUrl);
          return dataUrl;
        }
      }
    } catch (error) {
      console.warn(`Failed to fetch logo for token ${token.canister_id}:`, error);
    }

    // Use default logo as fallback
    return DEFAULT_LOGOS.DEFAULT;
  } catch (error) {
    console.error('Error in fetchTokenLogo:', error);
    return DEFAULT_LOGOS.DEFAULT;
  }
}