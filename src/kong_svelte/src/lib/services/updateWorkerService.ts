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
import {
  formatTokenAmount,
  formatToNonZeroDecimal,
} from "$lib/utils/numberFormatUtils";
import type { WorkerApi } from "$lib/workers/updateWorker";
import { appLoader } from "$lib/services/appLoader";

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
      if (!currentStore.tokens) return;

      const prices = (await Promise.race([
        tokenStore.loadPrices(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Price update timeout")), 5000),
        ),
      ])) as Record<string, number>;

      if (prices && typeof prices === "object") {
        const balances = { ...currentStore.balances };
        for (const token of currentStore.tokens) {
          if (balances[token.canister_id]) {
            const price = prices[token.canister_id] || 0;
            const balance = balances[token.canister_id].in_tokens;
            const amount = Number(formatTokenAmount(balance.toString(), token.decimals));
            balances[token.canister_id].in_usd = formatToNonZeroDecimal(amount * price);
          }
        }
      }
    } catch (error) {
      console.error("Error during price update:", error);
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
