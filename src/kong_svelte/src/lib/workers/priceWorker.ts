import * as Comlink from 'comlink';
import { calculate24hPriceChange } from '$lib/price/priceService';
import { TokenService } from '$lib/services/tokens/TokenService';
import { CKUSDT_CANISTER_ID } from '$lib/constants/canisterConstants';
import { ICP_CANISTER_ID } from '$lib/constants/canisterConstants';
import BigNumber from 'bignumber.js';
import { kongDB } from "$lib/services/db";

export interface PriceWorkerApi {
  startUpdates(): Promise<void>;
  stopUpdates(): Promise<void>;
  setTokens(tokens: FE.Token[]): Promise<void>;
}

class PriceWorkerImpl implements PriceWorkerApi {
  private updateInterval: number | null = null;
  private tokens: FE.Token[] = [];
  protected isPaused = false;
  private lastKnownPrices: Record<string, number> = {};
  
  // Adjust intervals based on visibility
  private readonly ACTIVE_UPDATE_INTERVAL = 15000;   // 30 seconds when active
  private readonly BACKGROUND_UPDATE_INTERVAL = 60000; // 60 seconds when in background

  async setTokens(tokens: FE.Token[]): Promise<void> {
    this.tokens = tokens;
    this.lastKnownPrices = Object.fromEntries(
      tokens.map(token => [
        token.canister_id, 
        Number(token.metrics?.price || 0)
      ])
    );
  }

  async startUpdates(): Promise<void> {
    // First trigger an immediate update if not paused
    if (!this.isPaused) {
      await this.postPriceUpdate();
    }
    // Then schedule future updates
    this.schedulePriceUpdate();
  }

  async stopUpdates(): Promise<void> {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  private async postPriceUpdate() {
    try {
      // Get pools data for volume calculations
      const pools = await kongDB.pools.toArray();
      const existingTokens = await kongDB.tokens.toArray();
      
      // Process tokens in smaller batches
      const batchSize = 30;
      const batches = [];
      for (let i = 0; i < this.tokens.length; i += batchSize) {
        batches.push(this.tokens.slice(i, i + batchSize));
      }

      const allUpdates = [];
      for (const batch of batches) {
        const batchUpdates = await Promise.all(
          batch.map(async (token) => {
            try {
              // Get price first
              const currentPrice = token.canister_id === ICP_CANISTER_ID 
                ? await TokenService.getIcpPrice()
                : await TokenService.fetchPrice(token);

              // Only proceed with other calculations if we have a valid price
              if (currentPrice > 0) {
                this.lastKnownPrices[token.canister_id] = currentPrice;

                // Update token with current price before calculating price change
                const tokenWithPrice = {
                  ...token,
                  metrics: {
                    ...token.metrics,
                    price: currentPrice.toString()
                  }
                };

                // Calculate price change with updated price
                const priceChange = token.canister_id === CKUSDT_CANISTER_ID 
                  ? 0 
                  : await calculate24hPriceChange(tokenWithPrice);

                const volume = this.calculateVolume(token, pools);
                const marketCap = this.calculateMarketCap(token, currentPrice);
                const existingToken = existingTokens.find(t => t.canister_id === token.canister_id);
                if (existingToken) {
                  const updatedToken = {
                    ...existingToken,
                    metrics: {
                      ...existingToken.metrics,
                      price: currentPrice.toString(),
                      price_change_24h: priceChange.toString(),
                      volume_24h: volume.toString(),
                      market_cap: marketCap,
                      total_supply: existingToken.metrics?.total_supply || "0",
                      updated_at: new Date().toISOString()
                    },
                    timestamp: Date.now()
                  };

                  await kongDB.tokens.put(updatedToken);
                }

                return {
                  id: token.canister_id,
                  price: currentPrice,
                  price_change_24h: priceChange,
                  volume: volume,
                  market_cap: marketCap
                };
              } else {
                return null;
              }
            } catch (error) {
              console.error(`Price worker: Error updating token ${token.symbol}:`, error);
              return null;
            }
          })
        );
        allUpdates.push(...batchUpdates.filter(Boolean));
        
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      const validUpdates = allUpdates.filter(update => update && update.price > 0);

      if (validUpdates.length > 0) {
        self.postMessage({ type: 'price_update', updates: validUpdates });
      }
    } catch (error) {
      console.error('Price worker: Error in price update:', error);
    }
  }

  public pause(): void {
    this.isPaused = true;
    this.updateInterval && clearInterval(this.updateInterval);
  }

  public resume(): void {
    this.isPaused = false;
    this.schedulePriceUpdate();
  }

  private schedulePriceUpdate(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    const interval = this.isPaused ? 
      this.BACKGROUND_UPDATE_INTERVAL : 
      this.ACTIVE_UPDATE_INTERVAL;

    this.updateInterval = self.setInterval(async () => {
      if (!this.isPaused) {
        await this.postPriceUpdate();
      }
    }, interval);
  }

  // Helper method to calculate volume
  private calculateVolume(token: FE.Token, pools: BE.Pool[]): number {
    const tokenPools = pools.filter((p: BE.Pool) => 
      p.address_0 === token.canister_id || p.address_1 === token.canister_id
    );

    // Calculate total volume across all pools
    const totalVolume = tokenPools.reduce((sum, pool) => {
      if (!pool.rolling_24h_volume) return sum;
      
      // Convert BigInt to string then to number to avoid precision issues
      const volume = Number(pool.rolling_24h_volume.toString());
      
      // If volume is in e-notation or very small, handle appropriately
      if (volume < 1e-6) return sum;
      
      // Convert to USD with proper decimal handling
      const volumeInUsd = volume / (10 ** 6);
      

      return sum + volumeInUsd;
    }, 0);

    return totalVolume;
  }

  // Helper method to calculate market cap
  private calculateMarketCap(token: FE.Token, price: number): string {
    if (!token.metrics?.total_supply) {
      return '0';
    }

    try {
      // Always use BigNumber for precision
      const totalSupply = new BigNumber(token.metrics.total_supply);
      const decimals = new BigNumber(10).pow(token.decimals);
      
      let marketCap;
      if (token.canister_id === CKUSDT_CANISTER_ID) {
        marketCap = totalSupply.div(new BigNumber(10 ** 6));
      } else {
        // For all other tokens:
        // 1. Convert total supply to base units by dividing by decimals
        // 2. Multiply by current price
        marketCap = totalSupply.div(decimals).times(price);
      }

      return marketCap.toString();
    } catch (error) {
      console.error(`Error calculating market cap for ${token.symbol}:`, {
        error,
        totalSupply: token.metrics.total_supply,
        decimals: token.decimals,
        price
      });
      return '0';
    }
  }
}

// Create a single instance
const workerInstance = new PriceWorkerImpl();

// Update message handler to use instance methods
self.addEventListener('message', (event) => {
  if (event.data.type === 'pause') {
    workerInstance.pause();
  } else if (event.data.type === 'resume') {
    workerInstance.resume();
  }
});

// Expose the instance instead of creating a new one
Comlink.expose(workerInstance); 