// src/lib/services/worker/updateWorkerService.ts

/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { tokenStore } from "./tokens/tokenStore";
import { poolStore } from "./pools/poolStore";
import { get } from "svelte/store";
import { auth } from "./auth";
import * as Comlink from "comlink";
import type { WorkerApi } from "$lib/workers/updateWorker";
import { appLoader } from "$lib/services/appLoader";
import { calculate24hPriceChange, priceStore } from "$lib/price/priceService";
import { CKUSDT_CANISTER_ID } from "$lib/constants/canisterConstants";
import { kongDB } from "./db";
import { TokenService } from "./tokens/TokenService";

class UpdateWorkerService {
  private worker: Worker | null = null;
  private workerApi: WorkerApi | null = null;
  private isInitialized = false;
  private isInBackground = false;
  private updateInterval: number | null = null;

  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  async initialize() {
    const INIT_TIMEOUT = 60000; // 60 seconds timeout
    try {
      await Promise.race([
        this.initializeWorker(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Initialization timeout")), INIT_TIMEOUT),
        ),
      ]);
      return true;
    } catch (error) {
      console.error("Failed to initialize update worker service:", error);
      // Start fallback updates if worker initialization fails
      this.startFallbackUpdates();
      return false;
    }
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.workerApi = null;
    }
  }

  // -------------------- Private Methods --------------------

  private async initializeWorker(): Promise<void> {
    console.log("Initializing update worker service...");

    document.addEventListener("visibilitychange", this.handleVisibilityChange.bind(this));

    this.worker = new Worker(
      new URL("../workers/updateWorker.ts", import.meta.url),
      { type: "module" },
    );

    this.workerApi = Comlink.wrap<WorkerApi>(this.worker);

    const tokens = get(tokenStore);
    if (!tokens?.tokens?.length) {
      await tokenStore.loadTokens();
    }

    await this.workerApi.setTokens(tokens.tokens);

    const updateStarted = await this.startUpdates();
    if (!updateStarted) {
      console.warn("Failed to start worker updates, falling back to direct updates");
      this.startFallbackUpdates();
      return;
    }

    this.isInitialized = true;
  }

  private handleVisibilityChange() {
    this.isInBackground = document.hidden;
    if (document.hidden) {
      if (this.worker) {
        this.worker.postMessage({ type: "pause" });
      }
    } else {
      if (this.worker) {
        this.worker.postMessage({ type: "resume" });
        this.forceUpdate();
      }
    }
  }

  private async forceUpdate() {
    const wallet = get(auth);
    const walletId = wallet?.account?.owner?.toString();
    if (!walletId) return;

    try {
      await Promise.all([
        tokenStore.loadBalances(walletId),
        poolStore.loadPools(true),
        this.updatePrices(),
      ]);
    } catch (error) {
      console.error("Error during force update:", error);
    }
  }

  private async updateTokens() {
    const wallet = get(auth);
    const walletId = wallet?.account?.owner?.toString();
    if (walletId) {
      await tokenStore.loadBalances(walletId);
    }
  }

  private async updatePools() {
    await poolStore.loadPools();
  }

  private async updatePrices() {
    try {
      const currentStore = get(tokenStore);
      if (!currentStore?.tokens?.length) return;

      const batchSize = 20;
      const tokens = currentStore.tokens;
      const batches = [];
      
      for (let i = 0; i < tokens.length; i += batchSize) {
        batches.push(tokens.slice(i, i + batchSize));
      }

      // Process each batch in parallel
      const updates = await Promise.all(
        batches.map(async (batch) => {
          const batchResults = await Promise.all(
            batch.map(async (token) => {
              try {
                const priceChange = token.canister_id === CKUSDT_CANISTER_ID ? 0 : await calculate24hPriceChange(token);
                const currentPrice = await TokenService.fetchPrice(token);
                
                // Get existing token from DB
                const existingToken = await kongDB.tokens.get(token.canister_id);
                
                // Prepare updated token with new price data
                const updatedToken = {
                  ...(existingToken || token),
                  metrics: {
                    ...(existingToken?.metrics || token.metrics),
                    price_change_24h: priceChange,
                    price: currentPrice.toString()
                  },
                  timestamp: Date.now()
                };

                // Update in DB
                await kongDB.tokens.put(updatedToken);

                return {
                  id: token.canister_id,
                  price: currentPrice,
                  priceChange: Number(priceChange)
                };
              } catch (error) {
                console.error(`Error updating token ${token.canister_id}:`, error);
                return {
                  id: token.canister_id,
                  price: Number(token.metrics?.price || 0),
                  priceChange: Number(token.metrics?.price_change_24h || 0)
                };
              }
            })
          );
          return batchResults;
        })
      );

      const flatUpdates = updates.flat();
      
      // Create maps for both price and price change
      const priceMap = Object.fromEntries(
        flatUpdates.map(update => [update.id, update.price])
      );
      const priceChangeMap = Object.fromEntries(
        flatUpdates.map(update => [update.id, update.priceChange])
      );

      // Update price store with numeric values
      priceStore.set(priceMap);

      // Update token store with both metrics and prices fields
      tokenStore.update((store) => {
        if (!store) return store;
        return {
          ...store,
          // Update the prices field for reactivity
          prices: {
            ...store.prices,
            ...priceMap
          },
          // Update token metrics
          tokens: store.tokens.map((token) => ({
            ...token,
            metrics: {
              ...token.metrics,
              price: priceMap[token.canister_id]?.toString() ?? token.metrics.price,
              price_change_24h: priceChangeMap[token.canister_id]?.toString() ?? token.metrics.price_change_24h
            }
          }))
        };
      });

      // Force a refresh of the live query
      await kongDB.tokens.toArray();

    } catch (error) {
      console.error("Error updating prices:", error);
    }
  }

  private async waitForTokens(): Promise<void> {
    const tokens = get(tokenStore);
    if (tokens?.tokens?.length) {
      return;
    }

    return new Promise<void>((resolve) => {
      const unsubscribe = tokenStore.subscribe((value) => {
        if (value?.tokens?.length) {
          console.log("Tokens loaded:", value.tokens.length);
          unsubscribe();
          resolve();
        }
      });
    });
  }

  private async startUpdates() {
    if (!this.workerApi) {
      console.error("Worker API not available");
      return false;
    }

    try {
      console.log("Starting worker updates...");
      await this.waitForTokens();
      await this.workerApi.startUpdates();
      console.log("Worker updates started, triggering immediate updates...");

      appLoader.updateLoadingState({
        isLoading: true,
        assetsLoaded: 0,
        totalAssets: get(tokenStore).tokens?.length || 0,
      });

      await Promise.all(
        [
          this.updateTokens(),
          this.updatePools(),
          !this.isInBackground && this.updatePrices(),
        ].filter(Boolean),
      );

      console.log("Initial updates completed successfully");
      return true;
    } catch (error) {
      console.error("Failed to start worker updates:", error);
      this.startFallbackUpdates();
      return false;
    }
  }

  private async startFallbackUpdates() {
    this.updateInterval = window.setInterval(() => {
      Promise.all(
        [
          this.updateTokens(),
          this.updatePools(),
          !this.isInBackground && this.updatePrices(),
        ].filter(Boolean),
      );
    }, 10000);

    await Promise.all(
      [
        this.updateTokens(),
        this.updatePools(),
        !this.isInBackground && this.updatePrices(),
      ].filter(Boolean),
    );
  }
}

export const updateWorkerService = new UpdateWorkerService();
