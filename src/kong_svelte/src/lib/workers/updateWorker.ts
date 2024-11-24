// Worker to handle periodic updates for tokens, pools, and swaps

import * as Comlink from 'comlink';

class UpdateWorker {
  private tokenUpdateInterval: number | null = null;
  private poolUpdateInterval: number | null = null;
  private swapActivityInterval: number | null = null;
  private priceUpdateInterval: number | null = null;

  private readonly INTERVALS = {
    TOKEN_UPDATE: 10000, // 10 seconds
    POOL_UPDATE: 30000,  // 30 seconds
    SWAP_ACTIVITY: 10000, // 10 seconds
    PRICE_UPDATE: 30000  // 30 seconds
  };

  startUpdates(callbacks: {
    onTokenUpdate: () => void,
    onPoolUpdate: () => void,
    onSwapActivityUpdate: () => void,
    onPriceUpdate: () => void
  }) {
    // Token updates
    this.tokenUpdateInterval = self.setInterval(() => {
      callbacks.onTokenUpdate();
    }, this.INTERVALS.TOKEN_UPDATE);

    // Pool updates
    this.poolUpdateInterval = self.setInterval(() => {
      callbacks.onPoolUpdate();
    }, this.INTERVALS.POOL_UPDATE);

    // Swap activity updates
    this.swapActivityInterval = self.setInterval(() => {
      callbacks.onSwapActivityUpdate();
    }, this.INTERVALS.SWAP_ACTIVITY);

    // Price updates
    this.priceUpdateInterval = self.setInterval(() => {
      callbacks.onPriceUpdate();
    }, this.INTERVALS.PRICE_UPDATE);
  }

  stopUpdates() {
    if (this.tokenUpdateInterval) clearInterval(this.tokenUpdateInterval);
    if (this.poolUpdateInterval) clearInterval(this.poolUpdateInterval);
    if (this.swapActivityInterval) clearInterval(this.swapActivityInterval);
    if (this.priceUpdateInterval) clearInterval(this.priceUpdateInterval);
    
    this.tokenUpdateInterval = null;
    this.poolUpdateInterval = null;
    this.swapActivityInterval = null;
    this.priceUpdateInterval = null;
  }

  // Trigger immediate updates
  async updateAll(callbacks: {
    onTokenUpdate: () => void,
    onPoolUpdate: () => void,
    onSwapActivityUpdate: () => void,
    onPriceUpdate: () => void
  }) {
    callbacks.onTokenUpdate();
    callbacks.onPoolUpdate();
    callbacks.onSwapActivityUpdate();
    callbacks.onPriceUpdate();
  }
}

Comlink.expose(UpdateWorker);
