// Worker to handle periodic updates for tokens, pools, and swaps

import * as Comlink from 'comlink';
import { DEFAULT_LOGOS } from '$lib/services/tokens/tokenLogos';

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
  complete: boolean;
}

type WorkerMessage = TokenLogoLoadedMessage | LoadingProgressMessage;

export interface BatchPreloadResult {
  success: boolean;
  error?: string;
  loadingState: AssetLoadingState;
}

export type UpdateType = 'token' | 'pool' | 'swapActivity' | 'price';

export interface WorkerApi {
  startUpdates(): Promise<void>;
  stopUpdates(): Promise<void>;
  setTokens(tokens: FE.Token[]): Promise<void>;
}

// Worker implementation class
class WorkerImpl implements WorkerApi {
  private preloadedAssets = new Set<string>();
  private objectUrls = new Set<string>(); // Track created object URLs
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
  }

  async setTokens(tokens: FE.Token[]): Promise<void> {
    this.tokens = tokens;
  }

  async loadTokenLogos(): Promise<Record<string, string>> {
    const logoMap: Record<string, string> = { ...DEFAULT_LOGOS };
    try {
      if (!this.tokens.length) {
        return logoMap;
      }
      // Post initial progress
      postMessage({ 
        type: 'LOADING_PROGRESS',
        loaded: 0,
        total: this.tokens.length,
        context: 'token_logos'
      });

      const BATCH_SIZE = 30;
      const batches = [];
      for (let i = 0; i < this.tokens.length; i += BATCH_SIZE) {
        batches.push(this.tokens.slice(i, i + BATCH_SIZE));
      }

      let totalProcessed = 0;

      for (const batch of batches) {
        const batchResults = await Promise.all(batch.map(async (token) => {
          try {
            const logoUrl = token?.logo;
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

  async startUpdates(): Promise<void> {
    try {
      // Start existing update intervals
      this.startTokenUpdates();
      this.startPoolUpdates();
      this.startSwapActivityUpdates();
      this.startPriceUpdates();

    } catch (error) {
      console.error('Worker: Error starting updates:', error);
      throw error;
    }
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
    this.cleanup();
  }

  // Clean up method to be called when stopping the worker
  private cleanup() {
    // Revoke any created object URLs
    this.objectUrls.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (error) {
        console.warn(`Failed to revoke object URL: ${url}`, error);
      }
    });
    this.objectUrls.clear();
  }

  // ... [Other methods remain unchanged]
}

Comlink.expose(new WorkerImpl());
