import { kongDB } from '../db';
import { ICP_CANISTER_ID } from '$lib/constants/canisterConstants';
import { createAnonymousActorHelper, auth, canisterIDLs } from '../auth';
import { writable, get } from 'svelte/store';
import type { KongImage } from './types';

export const IMAGE_CACHE_DURATION = 1 * 60 * 60 * 1000; // 1 hour
export const DEFAULT_LOGOS = {
  [ICP_CANISTER_ID]: '/tokens/icp.webp',
  DEFAULT: '/tokens/not_verified.webp'
} as const;
export const tokenLogoStore = writable<Record<string, string>>({});

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
    if (token.canister_id === ICP_CANISTER_ID) {
      return DEFAULT_LOGOS[ICP_CANISTER_ID];
    }

    // First try to get from cache
    const cachedLogo = await kongDB.images.where('canister_id').equals(token.canister_id).first();
    if (cachedLogo && Date.now() - cachedLogo.timestamp < IMAGE_CACHE_DURATION) {
      return cachedLogo.image_url;
    }

    // If not in cache or expired, fetch from canister
    const wallet = get(auth);
    const actor = await auth.getActor(token.canister_id, canisterIDLs.icrc1, { anon: true });
    const res: any = await actor.icrc1_metadata();
    console.log('Got icrc1 metadata:', res);
    const logoEntry = res.find(
      ([key]) => key === 'icrc1:logo' || key === 'icrc1_logo'
    );

    let logoUrl = DEFAULT_LOGOS.DEFAULT;
    if (logoEntry && logoEntry[1]?.Text) {
      logoUrl = logoEntry[1].Text;
      // Cache the logo
      await kongDB.images.put({
        canister_id: token.canister_id,
        image_url: logoUrl,
        timestamp: Date.now()
      });
    }

    return logoUrl;
  } catch (error) {
    // Log the error but don't throw, return default logo instead
    console.warn('Error getting icrc1 token metadata:', {
      canister_id: token.canister_id,
      error: error?.message || error
    });
    return DEFAULT_LOGOS.DEFAULT;
  }
}