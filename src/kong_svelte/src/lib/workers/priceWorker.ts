import * as Comlink from "comlink";
import { calculate24hPriceChange } from "$lib/price/priceService";
import { TokenService } from "$lib/services/tokens/TokenService";
import { CKUSDT_CANISTER_ID, ICP_CANISTER_ID } from "$lib/constants/canisterConstants";
import BigNumber from "bignumber.js";
import { kongDB } from "$lib/services/db";

// Configuration constants
const CONFIG = {
  BATCH_SIZE: 30,
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,
  CACHE_DURATION: 10 * 1000, // 10 seconds
  CIRCUIT_BREAKER_THRESHOLD: 5,
  CIRCUIT_BREAKER_RESET_TIME: 5 * 60 * 1000, // 5 minutes
};

export interface PriceWorkerApi {
  startUpdates(): Promise<void>;
  stopUpdates(): Promise<void>;
  setTokens(tokens: FE.Token[]): Promise<void>;
}

class PriceWorkerImpl implements PriceWorkerApi {
  private updateInterval: number | null = null;
  private tokens: FE.Token[] = [];
  protected isPaused = false;
  private failureCount: Map<string, number> = new Map();
  private circuitBreakerTimers: Map<string, number> = new Map();
  private metrics = {
    totalUpdates: 0,
    successfulUpdates: 0,
    failedUpdates: 0,
    lastUpdateDuration: 0,
    averageUpdateDuration: 0,
  };

  // Adjust intervals based on visibility
  private readonly ACTIVE_UPDATE_INTERVAL = 15000; // 15 seconds when active
  private readonly BACKGROUND_UPDATE_INTERVAL = 45000; // 45 seconds when in background

  async setTokens(tokens: FE.Token[]): Promise<void> {
    this.tokens = tokens;
  }

  async startUpdates(): Promise<void> {
    if (!this.isPaused) {
      await this.postPriceUpdate();
    }
    this.schedulePriceUpdate();
  }

  async stopUpdates(): Promise<void> {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  private isCircuitBroken(tokenId: string): boolean {
    return this.failureCount.get(tokenId) >= CONFIG.CIRCUIT_BREAKER_THRESHOLD;
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    tokenId: string,
  ): Promise<T> {
    let lastError: Error;
    for (let i = 0; i < CONFIG.MAX_RETRIES; i++) {
      try {
        const result = await operation();
        // Reset failure count on success
        this.failureCount.set(tokenId, 0);
        return result;
      } catch (error) {
        lastError = error as Error;
        await new Promise((resolve) => setTimeout(resolve, CONFIG.RETRY_DELAY * (i + 1)));
      }
    }
    
    // Update failure count and check circuit breaker
    const currentFailures = (this.failureCount.get(tokenId) || 0) + 1;
    this.failureCount.set(tokenId, currentFailures);
    
    if (currentFailures >= CONFIG.CIRCUIT_BREAKER_THRESHOLD) {
      // Set circuit breaker timer if not already set
      if (!this.circuitBreakerTimers.has(tokenId)) {
        this.circuitBreakerTimers.set(
          tokenId,
          window.setTimeout(() => {
            this.failureCount.set(tokenId, 0);
            this.circuitBreakerTimers.delete(tokenId);
          }, CONFIG.CIRCUIT_BREAKER_RESET_TIME),
        );
      }
    }
    
    throw lastError;
  }

  private async updateTokenPrice(token: FE.Token, pools: BE.Pool[]): Promise<FE.Token | null> {
    try {
      if (this.isCircuitBroken(token.canister_id)) {
        console.warn(`Circuit breaker active for token ${token.symbol}`);
        return null;
      }

      const previousPrice = token.metrics?.price || "0";
      const currentPrice = token.canister_id === ICP_CANISTER_ID
        ? await this.retryOperation(() => TokenService.getIcpPrice(), token.canister_id)
        : await this.retryOperation(() => TokenService.fetchPrice(token), token.canister_id);

      // Log price changes
      if (previousPrice === currentPrice.toString()) {
        return null;
      }

      // Calculate metrics
      const volume = this.calculateVolume(token, pools);
      const marketCap = this.calculateMarketCap(token, currentPrice);
      const tvl = this.calculateTvl(token, pools);

      const priceChange = token.canister_id === CKUSDT_CANISTER_ID
        ? 0
        : await calculate24hPriceChange({
            ...token,
            metrics: {
              ...token.metrics,
              previous_price: previousPrice,
              price: currentPrice.toString(),
            },
          });

      const updatedToken = {
        ...token,
        metrics: {
          ...token.metrics,
          price: currentPrice.toString(),
          previous_price: previousPrice,
          price_change_24h: priceChange.toString(),
          volume_24h: volume.toString(),
          market_cap: marketCap,
          tvl: tvl.toString(),
          total_supply: token.metrics?.total_supply || "0",
          updated_at: new Date().toISOString(),
        },
        timestamp: Date.now(),
      };

      return updatedToken;

    } catch (error) {
      console.error(`Price worker: Error updating token ${token.symbol}:`, error);
      this.metrics.failedUpdates++;
      return null;
    }
  }

  private async postPriceUpdate() {
    const startTime = performance.now();
    this.metrics.totalUpdates++;

    try {
      this.tokens = await kongDB.tokens.toArray();
      const pools = await kongDB.pools.toArray();

      // Process tokens in configurable batches
      const batches = [];
      for (let i = 0; i < this.tokens.length; i += CONFIG.BATCH_SIZE) {
        batches.push(this.tokens.slice(i, i + CONFIG.BATCH_SIZE));
      }

      const allUpdates = [];
      for (const batch of batches) {
        const batchUpdates = await Promise.all(
          batch.map((token) => this.updateTokenPrice(token, pools))
        );
        allUpdates.push(...batchUpdates.filter(Boolean));
      }

      const validUpdates = allUpdates.filter((update) => update !== null);

      if (validUpdates.length > 0) {
        await kongDB.tokens.bulkPut(validUpdates);
        self.postMessage({ type: "price_update", updates: validUpdates });
        this.metrics.successfulUpdates++;
      }

      // Update performance metrics
      const duration = performance.now() - startTime;
      this.metrics.lastUpdateDuration = duration;
      this.metrics.averageUpdateDuration = 
        (this.metrics.averageUpdateDuration * (this.metrics.totalUpdates - 1) + duration) / 
        this.metrics.totalUpdates;

      // Log performance metrics periodically
      if (this.metrics.totalUpdates % 10 === 0) {
        console.log("Price Worker Metrics:", {
          ...this.metrics,
          successRate: (this.metrics.successfulUpdates / this.metrics.totalUpdates) * 100,
        });
      }

    } catch (error) {
      console.error("❌ Price worker error:", error);
      this.metrics.failedUpdates++;
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

    const interval = this.isPaused
      ? this.BACKGROUND_UPDATE_INTERVAL
      : this.ACTIVE_UPDATE_INTERVAL;

    this.updateInterval = self.setInterval(async () => {
      if (!this.isPaused) {
        await this.postPriceUpdate();
      }
    }, interval);
  }

  private calculateTvl(token: FE.Token, pools: BE.Pool[]): number {
    const tokenPools = pools.filter(
      (pool) =>
        pool.address_0 === token.canister_id ||
        pool.address_1 === token.canister_id,
    );

    const totalTvl = tokenPools.reduce((sum, pool) => {
      if (!pool.tvl) return sum;
      return (
        sum +
        new BigNumber(pool.tvl.toString()).div(new BigNumber(1e6)).toNumber()
      );
    }, 0);

    return totalTvl;
  }

  // Helper method to calculate volume
  private calculateVolume(token: FE.Token, pools: BE.Pool[]): number {
    const tokenPools = pools.filter(
      (p: BE.Pool) =>
        p.address_0 === token.canister_id || p.address_1 === token.canister_id,
    );

    // Calculate total volume across all pools
    const totalVolume = tokenPools.reduce((sum, pool) => {
      if (!pool.rolling_24h_volume) return sum;

      // Convert BigInt to string then to number to avoid precision issues
      const volume = Number(pool.rolling_24h_volume.toString());

      // If volume is in e-notation or very small, handle appropriately
      if (volume < 1e-6) return sum;

      // Convert to USD with proper decimal handling
      const volumeInUsd = volume / 10 ** 6;

      return sum + volumeInUsd;
    }, 0);

    return totalVolume;
  }

  // Helper method to calculate market cap
  private calculateMarketCap(token: FE.Token, price: number): string {
    if (!token.metrics?.total_supply) {
      return "0";
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
        price,
      });
      return "0";
    }
  }
}

// Create a single instance
const workerInstance = new PriceWorkerImpl();

// Update message handler to use instance methods
self.addEventListener("message", (event) => {
  if (event.data.type === "pause") {
    workerInstance.pause();
  } else if (event.data.type === "resume") {
    workerInstance.resume();
  }
});

// Expose the instance instead of creating a new one
Comlink.expose(workerInstance);
