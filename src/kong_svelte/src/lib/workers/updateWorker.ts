// src/lib/workers/updateWorker.ts

import * as Comlink from 'comlink';

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
}

export type UpdateType = 'token' | 'pool' | 'price';

export interface WorkerApi {
  startUpdates(): Promise<void>;
  stopUpdates(): Promise<void>;
  setTokens(tokens: FE.Token[]): Promise<void>;
}

class WorkerImpl implements WorkerApi {
  private objectUrls = new Set<string>();

  private tokenUpdateInterval: number | null = null;
  private poolUpdateInterval: number | null = null;
  private priceUpdateInterval: number | null = null;

  private readonly INTERVALS = {
    TOKEN_UPDATE: 60000,      // 1 minute
    POOL_UPDATE: 30000,       // 30 seconds
    PRICE_UPDATE: 20000,      // 20 seconds
  };

  private tokens: FE.Token[] = [];

  async setTokens(tokens: FE.Token[]): Promise<void> {
    this.tokens = tokens;
  }

  async startUpdates(): Promise<void> {
    try {
      // Start periodic updates
      this.startTokenUpdates();
      this.startPoolUpdates();
      this.startPriceUpdates();
    } catch (error) {
      console.error('Worker: Error starting updates:', error);
      throw error;
    }
  }

  async stopUpdates(): Promise<void> {
    if (this.tokenUpdateInterval) clearInterval(this.tokenUpdateInterval);
    if (this.poolUpdateInterval) clearInterval(this.poolUpdateInterval);
    if (this.priceUpdateInterval) clearInterval(this.priceUpdateInterval);

    this.tokenUpdateInterval = null;
    this.poolUpdateInterval = null;
    this.priceUpdateInterval = null;
    this.cleanup();
  }

  // -------------------- Private Methods --------------------

  private postUpdateMessage(updateType: UpdateType) {
    try {
      self.postMessage({ type: 'update', updateType });
    } catch (error) {
      console.error(`Worker: Failed to post ${updateType} update message:`, error);
    }
  }

  private startTokenUpdates(): void {
    if (this.tokenUpdateInterval) return;
    this.postUpdateMessage('token');
    this.tokenUpdateInterval = self.setInterval(() => {
      console.log('Worker: Token update interval triggered');
      this.postUpdateMessage('token');
    }, this.INTERVALS.TOKEN_UPDATE);
  }

  private startPoolUpdates(): void {
    if (this.poolUpdateInterval) return;
    this.postUpdateMessage('pool');
    this.poolUpdateInterval = self.setInterval(() => {
      console.log('Worker: Pool update interval triggered');
      this.postUpdateMessage('pool');
    }, this.INTERVALS.POOL_UPDATE);
  }

  private startPriceUpdates(): void {
    if (this.priceUpdateInterval) return;
    this.postUpdateMessage('price');
    this.priceUpdateInterval = self.setInterval(() => {
      console.log('Worker: Price update interval triggered');
      this.postUpdateMessage('price');
    }, this.INTERVALS.PRICE_UPDATE);
  }

  private cleanup() {
    this.objectUrls.forEach(url => {
      try {
        URL.revokeObjectURL(url);
      } catch (error) {
        console.warn(`Failed to revoke object URL: ${url}`, error);
      }
    });
    this.objectUrls.clear();
  }
}

Comlink.expose(new WorkerImpl());
