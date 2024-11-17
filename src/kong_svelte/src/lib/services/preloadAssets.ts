import { assetCache } from './assetCache';

export const BACKGROUND_IMAGES = {
  pools: '/backgrounds/pools.webp',
  jungle: '/backgrounds/kong_jungle2.webp'
} as const;

export async function preloadBackgroundImages() {
  await assetCache.preloadAssets(Object.values(BACKGROUND_IMAGES));
}
