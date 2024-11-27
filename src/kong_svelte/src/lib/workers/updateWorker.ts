// Worker to handle periodic updates for tokens, pools, and swaps

import * as Comlink from 'comlink';
import { get } from 'svelte/store';
import { tokenStore } from '$lib/services/tokens/tokenStore';
import { DEFAULT_LOGOS, fetchTokenLogo, tokenLogoStore, IMAGE_CACHE_DURATION } from '$lib/services/tokens/tokenLogos';
import { auth, canisterIDLs } from '$lib/services/auth';
import { kongDB } from '$lib/services/db';
import type { KongImage } from '$lib/services/tokens/types';

interface AssetLoadingState {
  assetsLoaded: number;
  totalAssets: number;
  errors: string[];
}

interface TokenLogoLoadedMessage {
  type: 'TOKEN_LOGOS_LOADED';
  logos: Record<string, string>;
}

interface LoadingProgressMessage {
  type: 'LOADING_PROGRESS';
  loaded: number;
  total: number;
  context: string;
}

type WorkerMessage = TokenLogoLoadedMessage | LoadingProgressMessage;

export interface BatchPreloadResult {
  success: boolean;
  error?: string;
  loadingState: AssetLoadingState;
}

export type UpdateType = 'token' | 'pool' | 'swapActivity' | 'price';

export interface WorkerApi {
  batchPreloadAssets(assets: string[], batchSize?: number): Promise<BatchPreloadResult>;
  preloadAsset(url: string): Promise<string>;
  startUpdates(): Promise<void>;
  stopUpdates(): Promise<void>;
  preloadAssets(assets: string[]): Promise<{
    loaded: number;
    total: number;
    errors: string[];
  }>;
  loadTokenLogos(): Promise<Record<string, string>>;
  setTokens(tokens: FE.Token[]): Promise<void>;
}

// Worker implementation class
class WorkerImpl implements WorkerApi {
  private preloadedAssets = new Set<string>();
  private loadingState: AssetLoadingState = {
    assetsLoaded: 0,
    totalAssets: 0,
    errors: []
  };

  private tokenUpdateInterval: number | null = null;
  private poolUpdateInterval: number | null = null;
  private swapActivityUpdateInterval: number | null = null;
  private priceUpdateInterval: number | null = null;
  private logoCleanupInterval: number | null = null;
  private logoRefreshInterval: number | null = null;

  private readonly INTERVALS = {
    TOKEN_UPDATE: 60000, // 1 minute
    POOL_UPDATE: 30000,  // 30 seconds
    SWAP_ACTIVITY: 19000, // 19 seconds
    PRICE_UPDATE: 20000,  // 20 seconds
    LOGO_CLEANUP: 3600000, // 1 hour
    LOGO_REFRESH: 1800000  // 30 minutes
  };

  private tokens: FE.Token[] = []; // Store tokens received from main thread

  constructor() {
    console.log('Worker: Initializing WorkerImpl...');
  }

  async setTokens(tokens: FE.Token[]): Promise<void> {
    this.tokens = tokens;
    console.log(`Worker: Received ${tokens.length} tokens`);

    // Optionally, you can trigger logo loading here
    await this.loadTokenLogos();
  }

  async loadTokenLogos(): Promise<Record<string, string>> {
    const logoMap: Record<string, string> = { ...DEFAULT_LOGOS };
    try {
      if (!this.tokens.length) {
        console.log('Worker: No tokens available for logo loading');
        return logoMap;
      }
      // Post initial progress
      postMessage({ 
        type: 'LOADING_PROGRESS',
        loaded: 0,
        total: this.tokens.length,
        context: 'token_logos'
      });

      const BATCH_SIZE = 5;
      const batches = [];
      for (let i = 0; i < this.tokens.length; i += BATCH_SIZE) {
        batches.push(this.tokens.slice(i, i + BATCH_SIZE));
      }

      let totalProcessed = 0;

      for (const batch of batches) {
        const batchResults = await Promise.all(batch.map(async (token) => {
          try {
            const logoUrl = await this.fetchAndCacheTokenLogo(token, DEFAULT_LOGOS.DEFAULT);
            totalProcessed++;
            
            // Update progress for each loaded logo
            postMessage({ 
              type: 'LOADING_PROGRESS',
              loaded: totalProcessed,
              total: this.tokens.length,
              context: 'token_logos'
            });
            
            if (logoUrl && logoUrl !== DEFAULT_LOGOS.DEFAULT) {
              return { canisterId: token.canister_id, logoUrl };
            } else {
              console.log(`Worker: No logo found for ${token.symbol} (${token.canister_id})`);
            }
          } catch (error) {
            console.warn(`Worker: Failed to load logo for ${token.symbol}:`, error);
            totalProcessed++;
          }
          return null;
        }));

        // Add successfully loaded logos to map
        batchResults.forEach(result => {
          if (result) {
            logoMap[result.canisterId] = result.logoUrl;
          }
        });

        // Post intermediate logos to main thread
        postMessage({ 
          type: 'TOKEN_LOGOS_LOADED',
          logos: { ...logoMap }
        });
      }
      
      return logoMap;
    } catch (error) {
      console.error('Worker: Error loading token logos:', error);
      return logoMap;
    }
  }

  private async fetchAndCacheTokenLogo(token: FE.Token, logo: string): Promise<string | null> {
    try {
      // Check if we have a cached version
      const cachedLogo = await this.getCachedLogo(token.canister_id);
      if (cachedLogo) {
        return cachedLogo;
      }

      const response = await fetchTokenLogo(token);
      
      // Cache the logo if it's not the default
      if (response) {
        await this.cacheLogo(token.canister_id, response);
      }
      
      return response;
    } catch (error) {
      console.warn(`Failed to fetch logo for ${token.symbol}:`, error);
      return null;
    }
  }

  private async getCachedLogo(canisterId: string): Promise<string | null> {
    // Implement caching logic here if needed
    return kongDB.images.get({ canister_id: canisterId }).then((image) => {
      if (image) {
        return image.image_url;
      }
      return null;
    });
  }

  private async cacheLogo(canisterId: string, logoUrl: string): Promise<void> {
    // Implement caching logic here if needed
    kongDB.images.put({ canister_id: canisterId, image_url: logoUrl } as KongImage);
  }

  private async waitForTokens(): Promise<void> {
    const tokens = get(tokenStore);
    if (tokens?.tokens?.length) {
      console.log('Worker: Tokens already loaded:', tokens.tokens.length);
      return;
    }

    console.log('Worker: Waiting for tokens to load...');
    return new Promise<void>((resolve) => {
      const unsubscribe = tokenStore.subscribe(value => {
        if (value?.tokens?.length) {
          console.log('Worker: Tokens loaded:', value.tokens.length);
          unsubscribe();
          resolve();
        }
      });
    });
  }

  private async getTokens() {
    await this.waitForTokens();
    const tokens = get(tokenStore);
    return tokens.tokens;
  }

  async batchPreloadAssets(assets: string[], batchSize: number = 5): Promise<BatchPreloadResult> {
    console.log(`Worker: Starting batch preload of ${assets.length} assets...`);
    
    try {
      this.loadingState.totalAssets = assets.length;
      this.loadingState.assetsLoaded = 0;
      this.loadingState.errors = [];

      // Filter out already loaded assets and data/blob URLs
      const assetsToLoad = assets.filter(url => 
        !this.preloadedAssets.has(url) && 
        !url.startsWith("data:image/") && 
        !url.startsWith("blob:")
      );

      // Process assets in batches
      for (let i = 0; i < assetsToLoad.length; i += batchSize) {
        const batch = assetsToLoad.slice(i, i + batchSize);
        await Promise.all(batch.map(url => this.preloadAsset(url)));
      }

      console.log('Worker: Batch preload completed');
      return {
        success: true,
        loadingState: { ...this.loadingState }
      };
    } catch (error) {
      console.error('Worker: Batch preload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        loadingState: { ...this.loadingState }
      };
    }
  }

  async preloadAsset(url: string): Promise<string> {
    if (
      this.preloadedAssets.has(url) ||
      url.startsWith("data:image/") || 
      url.startsWith("blob:")
    ) {
      return url;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch asset: ${response.statusText}`);
      }

      const contentType = response.headers.get("Content-Type") || "";
      const extension = url.split('.').pop()?.toLowerCase();

      if (extension === 'svg') {
        const svgContent = await response.text();
        if (!svgContent.includes('<svg')) {
          throw new Error('Invalid SVG content');
        }
        this.preloadedAssets.add(url);
        this.loadingState.assetsLoaded += 1;
        return url; // Assuming the URL is valid
      } else if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'ico'].includes(extension || '')) {
        const blob = await response.blob();
        const objectURL = URL.createObjectURL(blob);
        // You might want to store objectURL if needed
        this.preloadedAssets.add(url);
        this.loadingState.assetsLoaded += 1;
        return objectURL;
      } else {
        console.warn(`Worker: Unsupported asset type for URL: ${url}`);
        return url;
      }
    } catch (error) {
      console.error(`Worker: Failed to preload asset ${url}:`, error);
      this.loadingState.errors.push(`Failed to load ${url}`);
      return '';
    }
  }

  async startUpdates(): Promise<void> {
    console.log('Worker: Starting updates...');
    try {
      // Start existing update intervals
      this.startTokenUpdates();
      this.startPoolUpdates();
      this.startSwapActivityUpdates();
      this.startPriceUpdates();

      // Start logo maintenance intervals
      this.startLogoCleanup();
      this.startLogoRefresh();

    } catch (error) {
      console.error('Worker: Error starting updates:', error);
      throw error;
    }
  }

  private startLogoCleanup(): void {
    if (this.logoCleanupInterval) return;
    this.logoCleanupInterval = self.setInterval(async () => {
      try {
        const expirationTime = Date.now() - IMAGE_CACHE_DURATION;
        await kongDB.images
          .where('timestamp')
          .below(expirationTime)
          .delete();
      } catch (error) {
        console.error('Worker: Error during logo cleanup:', error);
      }
    }, this.INTERVALS.LOGO_CLEANUP);
  }

  private startLogoRefresh(): void {
    if (this.logoRefreshInterval) return;
    this.logoRefreshInterval = self.setInterval(async () => {
      try {
        const refreshThreshold = Date.now() - (IMAGE_CACHE_DURATION * 0.9); // Refresh logos that are 75% through their lifetime
        const agingLogos = await kongDB.images
          .where('timestamp')
          .below(refreshThreshold)
          .toArray();

        for (const logo of agingLogos) {
          if (!logo.canister_id) continue;
          try {
            const token = this.tokens.find(t => t.canister_id === logo.canister_id);
            if (token) {
              await fetchTokenLogo(token);
            }
          } catch (error) {
            console.error(`Worker: Error refreshing logo for ${logo.canister_id}:`, error);
          }
        }
      } catch (error) {
        console.error('Worker: Error during logo refresh:', error);
      }
    }, this.INTERVALS.LOGO_REFRESH);
  }

  private startTokenUpdates(): void {
    if (this.tokenUpdateInterval) return;
    
    // Do initial update
    this.postUpdateMessage('token');
    
    this.tokenUpdateInterval = self.setInterval(() => {
      console.log('Worker: Token update interval triggered');
      this.postUpdateMessage('token');
    }, this.INTERVALS.TOKEN_UPDATE);
  }

  private startPoolUpdates(): void {
    if (this.poolUpdateInterval) return;
    
    // Do initial update
    this.postUpdateMessage('pool');
    
    this.poolUpdateInterval = self.setInterval(() => {
      console.log('Worker: Pool update interval triggered');
      this.postUpdateMessage('pool');
    }, this.INTERVALS.POOL_UPDATE);
  }

  private startSwapActivityUpdates(): void {
    if (this.swapActivityUpdateInterval) return;
    
    // Do initial update
    this.postUpdateMessage('swapActivity');
    
    this.swapActivityUpdateInterval = self.setInterval(() => {
      console.log('Worker: Swap activity interval triggered');
      this.postUpdateMessage('swapActivity');
    }, this.INTERVALS.SWAP_ACTIVITY);
  }

  private startPriceUpdates(): void {
    if (this.priceUpdateInterval) return;
    
    // Do initial update
    this.postUpdateMessage('price');
    
    this.priceUpdateInterval = self.setInterval(() => {
      console.log('Worker: Price update interval triggered');
      this.postUpdateMessage('price');
    }, this.INTERVALS.PRICE_UPDATE);
  }

  private postUpdateMessage(updateType: UpdateType) {
    try {
      self.postMessage({ type: 'update', updateType });
    } catch (error) {
      console.error(`Worker: Failed to post ${updateType} update message:`, error);
    }
  }

  async stopUpdates(): Promise<void> {
    if (this.tokenUpdateInterval) clearInterval(this.tokenUpdateInterval);
    if (this.poolUpdateInterval) clearInterval(this.poolUpdateInterval);
    if (this.swapActivityUpdateInterval) clearInterval(this.swapActivityUpdateInterval);
    if (this.priceUpdateInterval) clearInterval(this.priceUpdateInterval);
    if (this.logoCleanupInterval) clearInterval(this.logoCleanupInterval);
    if (this.logoRefreshInterval) clearInterval(this.logoRefreshInterval);
    
    this.tokenUpdateInterval = null;
    this.poolUpdateInterval = null;
    this.swapActivityUpdateInterval = null;
    this.priceUpdateInterval = null;
    this.logoCleanupInterval = null;
    this.logoRefreshInterval = null;
  }

  async preloadAssets(assets: string[]): Promise<{
    loaded: number;
    total: number;
    errors: string[];
  }> {
    console.log(`Worker: Preloading ${assets.length} assets...`);
    let loaded = 0;
    const errors: string[] = [];

    for (const asset of assets) {
      try {
        await this.preloadAsset(asset);
        loaded++;
      } catch (error) {
        console.error(`Worker: Failed to preload asset ${asset}:`, error);
        errors.push(
          `Failed to load ${asset}: ${error instanceof Error ? error.message : String(error)}`
        );
        loaded++; // Increment to show progress even on error
      }
    }

    return {
      loaded,
      total: assets.length,
      errors,
    };
  }

  // ... [Other methods remain unchanged]
}

Comlink.expose(new WorkerImpl());
