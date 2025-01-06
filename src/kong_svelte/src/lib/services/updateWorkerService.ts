// src/lib/services/worker/updateWorkerService.ts

/// <reference types="@sveltejs/kit" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { loadBalances } from "./tokens/tokenStore";
import { loadPools } from "./pools/poolStore";
import { get } from "svelte/store";
import { auth } from "./auth";
import * as Comlink from "comlink";
import type { StateWorkerApi } from "$lib/workers/stateWorker";
import { appLoader } from "$lib/services/appLoader";
import { kongDB } from "./db";
import { TokenService } from "./tokens";
import { PoolService } from "./pools";

class UpdateWorkerService {
  private stateWorker: Worker | null = null;
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

    try {
      const tokens = await kongDB.tokens.toArray();
      if (!tokens?.length) {
        console.log("No tokens found, loading tokens...");
        await TokenService.fetchTokens();
      }

      // Initialize state worker after price worker is ready
      console.log("Creating state worker...");
      this.stateWorker = new Worker(
        new URL("../workers/stateWorker.ts", import.meta.url),
        { type: "module" }
      );
      this.stateWorkerApi = Comlink.wrap<StateWorkerApi>(this.stateWorker);
      this.stateWorker.onmessage = this.handleStateWorkerMessage.bind(this);

      console.log("Starting worker updates...");
      const updateStarted = await this.startUpdates();
      if (!updateStarted) {
        console.warn("Failed to start worker updates, falling back to direct updates");
        this.startFallbackUpdates();
        return;
      }

      this.isInitialized = true;
      console.log("Worker initialization complete");
    } catch (error) {
      console.error("Error during worker initialization:", error);
      this.startFallbackUpdates();
      throw error;
    }
  }

  private handleVisibilityChange() {
    this.isInBackground = document.hidden;
    if (document.hidden) {
      if (this.stateWorker) {
        this.stateWorker.postMessage({ type: "pause" });
      }
    } else {
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
    console.log("updateTokens");
    const wallet = get(auth);
    const walletId = wallet?.account?.owner?.toString();

    try {
      if (walletId) {
        console.log("Updating token balances for wallet:", walletId);
        await Promise.all([
          loadBalances(walletId),
          TokenService.fetchTokens(),
        ]);
      } else {  
        await TokenService.fetchTokens();
      }
  
      console.log("Token balances updated successfully");
    } catch (error) {
      console.error("Error updating token balances:", error);
      throw error;
    }
  }

  private async updatePools() {
    const user = get(auth);
    if (user) {
      await PoolService.fetchUserPoolBalances(true);
    }
    await loadPools();
  }

  private async startUpdates() {

    try {
      console.log("Starting worker updates...");

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

  private handleStateWorkerMessage(event: MessageEvent) {
    console.log("Received worker message:", event.data);
    if (event.data.type === 'token_update') {
      console.log("Processing token update...");
      this.updateTokens().catch(error => {
        console.error("Error updating tokens:", error);
      });
    } else if (event.data.type === 'pool_update') {
      console.log("Processing pool update...");
      this.updatePools().catch(error => {
        console.error("Error updating pools:", error);
      });
    }
  }
}

export const updateWorkerService = new UpdateWorkerService();
