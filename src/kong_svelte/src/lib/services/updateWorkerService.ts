// src/lib/services/worker/updateWorkerService.ts

/// <reference types="@sveltejs/kit" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { loadBalances, loadTokens } from "./tokens/tokenStore";
import { loadPools } from "./pools/poolStore";
import { get } from "svelte/store";
import { auth } from "./auth";
import * as Comlink from "comlink";
import type { PriceWorkerApi } from "$lib/workers/priceWorker";
import type { StateWorkerApi } from "$lib/workers/stateWorker";
import { appLoader } from "$lib/services/appLoader";
import { kongDB } from "./db";

class UpdateWorkerService {
  private priceWorker: Worker | null = null;
  private stateWorker: Worker | null = null;
  private priceWorkerApi: PriceWorkerApi | null = null;
  private stateWorkerApi: StateWorkerApi | null = null;
  private isInitialized = false;
  private isInBackground = false;
  private updateInterval: number | null = null;

  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  async initialize() {
    const INIT_TIMEOUT = 120000; // 120 seconds timeout
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
    if (this.priceWorker) {
      this.priceWorker.terminate();
      this.priceWorker = null;
      this.priceWorkerApi = null;
    }
    if (this.stateWorker) {
      this.stateWorker.terminate();
      this.stateWorker = null;
      this.stateWorkerApi = null;
    }
  }

  // -------------------- Private Methods --------------------

  private async initializeWorker(): Promise<void> {
    console.log("Initializing update worker services...");

    document.addEventListener("visibilitychange", this.handleVisibilityChange.bind(this));

    // Initialize price worker first and wait for it
    this.priceWorker = new Worker(
      new URL("../workers/priceWorker.ts", import.meta.url),
      { type: "module" }
    );
    this.priceWorkerApi = Comlink.wrap<PriceWorkerApi>(this.priceWorker);

    // Set up message handlers
    this.priceWorker.onmessage = this.handlePriceWorkerMessage.bind(this);

    const tokens = await kongDB.tokens.toArray();
    if (!tokens?.length) {
      await loadTokens();
    }

    await this.priceWorkerApi.setTokens(tokens);
    await this.priceWorkerApi.startUpdates();

    // Initialize state worker after price worker is ready
    this.stateWorker = new Worker(
      new URL("../workers/stateWorker.ts", import.meta.url),
      { type: "module" }
    );
    this.stateWorkerApi = Comlink.wrap<StateWorkerApi>(this.stateWorker);
    this.stateWorker.onmessage = this.handleStateWorkerMessage.bind(this);

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
      if (this.priceWorker) {
        this.priceWorker.postMessage({ type: "pause" });
      }
      if (this.stateWorker) {
        this.stateWorker.postMessage({ type: "pause" });
      }
    } else {
      if (this.priceWorker) {
        this.priceWorker.postMessage({ type: "resume" });
      }
      if (this.stateWorker) {
        this.stateWorker.postMessage({ type: "resume" });
      }
      this.forceUpdate();
    }
  }

  private async forceUpdate() {
    const wallet = get(auth);
    const walletId = wallet?.account?.owner?.toString();
    if (!walletId) return;

    try {
      await Promise.all([
        loadBalances(walletId),
        loadPools(),
      ]);
    } catch (error) {
      console.error("Error during force update:", error);
    }
  }

  private async updateTokens() {
    const wallet = get(auth);
    const walletId = wallet?.account?.owner?.toString();
    if (walletId) {
      await loadBalances(walletId);
    }
  }

  private async updatePools() {
    await loadPools();
  }

  private async startUpdates() {
    if (!this.priceWorkerApi || !this.stateWorkerApi) {
      console.error("Worker API not available");
      return false;
    }

    try {
      console.log("Starting worker updates...");
      await this.priceWorkerApi.startUpdates();

      appLoader.updateLoadingState({
        isLoading: true,
        assetsLoaded: 0,
        totalAssets: (await kongDB.tokens.toArray())?.length || 0,
      });

      await Promise.all(
        [
          this.updateTokens(),
          this.updatePools(),
        ].filter(Boolean),
      );

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
        ].filter(Boolean),
      );
    }, 10000);

    await Promise.all(
      [
        this.updateTokens(),
        this.updatePools(),
      ].filter(Boolean),
    );
  }

  private async handlePriceWorkerMessage(event: MessageEvent) {
    if (event.data.type === 'price_update') {
      const { updates } = event.data;
    }
  }

  private handleStateWorkerMessage(event: MessageEvent) {
    if (event.data.type === 'token_update') {
      this.updateTokens();
    } else if (event.data.type === 'pool_update') {
      this.updatePools();
    }
  }
}

export const updateWorkerService = new UpdateWorkerService();
