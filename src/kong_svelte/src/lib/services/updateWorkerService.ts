/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { tokenStore } from "./tokens/tokenStore";
import { poolStore } from "./pools/poolStore";
import { get } from "svelte/store";
import { auth } from "./auth";
import * as Comlink from "comlink";
import { formatTokenAmount, formatToNonZeroDecimal } from "$lib/utils/numberFormatUtils";
import type { WorkerApi, UpdateType } from "$lib/workers/updateWorker";
import { appLoader } from "$lib/services/appLoader"; // Import appLoader

class UpdateWorkerService {
  private worker: Worker | null = null;
  private workerApi: WorkerApi | null = null;
  private isInitialized = false;
  private isInBackground = false;
  private updateInterval: number | null = null;

  // Public getter for initialization status
  public getIsInitialized(): boolean {
    return this.isInitialized;
  }

  async initialize() {
    const INIT_TIMEOUT = 60000; // 60 seconds timeout
    
    try {
      await Promise.race([
        this.initializeWorker(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Initialization timeout')), INIT_TIMEOUT)
        )
      ]);
      return true;
    } catch (error) {
      console.error('Failed to initialize update worker service:', error);
      // Start fallback updates if worker initialization fails
      this.startFallbackUpdates();
      return false;
    }
  }

  private handleVisibilityChange() {
    this.isInBackground = document.hidden;
    if (document.hidden) {
      // Pause updates when in background
      if (this.worker) {
        this.worker.postMessage({ type: 'pause' });
      }
    } else {
      // Resume updates when back in foreground
      if (this.worker) {
        this.worker.postMessage({ type: 'resume' });
        // Force an immediate update when coming back
        this.forceUpdate();
      }
    }
  }

  private handleWorkerMessage(event: MessageEvent) {
    if (event.data.type === 'TOKEN_LOGOS_LOADED') {
      return;
    }

    if (event.data.type === 'LOADING_PROGRESS' && event.data.context === 'token_logos') {
      appLoader.updateLoadingState({
        isLoading: event.data.loaded < event.data.total,
        assetsLoaded: event.data.loaded,
        totalAssets: event.data.total,
      });
      return;
    }

    if (event.data.type === 'update') {
      const updateType = event.data.updateType as UpdateType;
      console.log('Received update message:', updateType);
      
      switch (updateType) {
        case 'token':
          this.updateTokens();
          break;
        case 'pool':
          this.updatePools();
          break;
        case 'swapActivity':
          this.updateSwapActivity();
          break;
        case 'price':
          if (!this.isInBackground) {
            this.updatePrices();
          }
          break;
      }
    }
  }

  private async forceUpdate() {
    const wallet = get(auth);
    const walletId = wallet?.account?.owner?.toString();
    if (walletId) {
      try {
        await Promise.all([
          tokenStore.loadBalances(walletId),
          poolStore.loadPools(true),
          this.updatePrices()
        ]);
      } catch (error) {
        console.error('Error during force update:', error);
      }
    }
  }

  private async updateTokens() {
    const wallet = get(auth);
    const walletId = wallet?.account?.owner?.toString();
    if (walletId) {
      await Promise.all([
        tokenStore.loadBalances(walletId),
      ]);
    }
  }

  private async updatePools() {
    const wallet = get(auth);
    const walletId = wallet?.account?.owner?.toString();
    if (walletId) {
      await Promise.all([
        poolStore.loadPools(),
        poolStore.loadUserPoolBalances(),
      ]);
    } else {
      await Promise.all([
        poolStore.loadPools(),
      ]);
    }
  }

  private async updateSwapActivity() {
    // Swap activity update logic here
  }

  private async updatePrices() {    
    try {
      const currentStore = get(tokenStore);
      if (!currentStore.tokens) return;

      const prices = await Promise.race([
        tokenStore.loadPrices(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Price update timeout')), 5000)
        )
      ]) as Record<string, number>;

      if (prices && typeof prices === 'object') {
        // After prices are loaded, update USD values in balances
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
      console.error('Error during price update:', error);
    }
  }

  private isCanisterUrl(url: string): boolean {
    return url.includes('.raw.icp0.io/d3?file_id=');
  }

  private async waitForTokens(): Promise<void> {
    const tokens = get(tokenStore);
    if (tokens?.tokens?.length) {
      console.log('Tokens already loaded:', tokens.tokens.length);
      return;
    }

    console.log('Waiting for tokens to load...');
    return new Promise<void>((resolve) => {
      const unsubscribe = tokenStore.subscribe(value => {
        if (value?.tokens?.length) {
          console.log('Tokens loaded:', value.tokens.length);
          unsubscribe();
          resolve();
        }
      });
    });
  }

  private async startUpdates() {
    if (!this.workerApi) {
      console.error('Worker API not available');
      return false;
    }

    try {
      console.log('Starting worker updates...');
      
      // Wait for initial token data
      await this.waitForTokens();

      // Start the worker's update intervals
      await this.workerApi.startUpdates();
      
      console.log('Worker updates started, triggering immediate updates...');
      
      // Update loading state for token logos
      appLoader.updateLoadingState({
        isLoading: true,
        assetsLoaded: 0,
        totalAssets: get(tokenStore).tokens?.length || 0,
      });

      // Trigger immediate updates and wait for them to complete
      await Promise.all([
        this.updateTokens(),
        this.updatePools(),
        this.updateSwapActivity(),
        !this.isInBackground && this.updatePrices(),
      ].filter(Boolean));

      console.log('Initial updates completed successfully');
      return true;
    } catch (error) {
      console.error("Failed to start worker updates:", error);
      this.startFallbackUpdates();
      return false;
    }
  }

  private async startFallbackUpdates() {
    // Set up intervals for fallback updates
    this.updateInterval = window.setInterval(() => {
      Promise.all([
        this.updateTokens(),
        this.updatePools(),
        this.updateSwapActivity(),
        !this.isInBackground && this.updatePrices(),
      ].filter(Boolean));
    }, 10000); // Update every 10 seconds

    // Trigger immediate updates
    await Promise.all([
      this.updateTokens(),
      this.updatePools(),
      this.updateSwapActivity(),
      !this.isInBackground && this.updatePrices(),
    ].filter(Boolean));
  }
  public async preloadAssets(assets: string[]): Promise<{
    loaded: number;
    total: number;
    errors: string[];
  }> {
    if (!this.workerApi) {
      console.warn('Worker not initialized, falling back to main thread asset loading');
      return this.fallbackPreloadAssets(assets);
    }

    try {
      return await this.workerApi.preloadAssets(assets);
    } catch (error) {
      console.error('Worker failed to preload assets:', error);
      return this.fallbackPreloadAssets(assets);
    }
  }

  private async fallbackPreloadAssets(assets: string[]): Promise<{
    loaded: number;
    total: number;
    errors: string[];
  }> {
    let loaded = 0;
    const errors: string[] = [];
    const total = assets.length;

    for (const asset of assets) {
      try {
        await fetch(asset);
        loaded++;
      } catch (error) {
        errors.push(`Failed to load ${asset}: ${error}`);
        loaded++; // Still increment to show progress
      }
    }

    return { loaded, total, errors };
  }

  async preloadAsset(url: string): Promise<string> {
    // If worker is not initialized, use direct asset loading
    if (!this.workerApi) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to load asset: ${response.statusText}`);
        }
        
        // Handle ICP canister URLs as images
        if (this.isCanisterUrl(url)) {
          const blob = await response.blob();
          if (!blob.type.startsWith('image/')) {
            console.warn(`Unexpected content type for canister asset: ${blob.type}`);
          }
          return URL.createObjectURL(blob);
        }
        
        // Handle other asset types
        if (url.endsWith('.svg')) {
          const text = await response.text();
          if (!text.includes('<svg')) {
            throw new Error('Invalid SVG content');
          }
          return url;
        } else if (url.match(/\.(png|jpe?g|gif|webp|bmp|ico)$/i)) {
          const blob = await response.blob();
          return URL.createObjectURL(blob);
        } else {
          console.warn(`Using original URL for unsupported asset type: ${url}`);
          return url;
        }
      } catch (error) {
        console.error(`Failed to preload asset ${url}:`, error);
        return url;
      }
    }
    
    return this.workerApi.preloadAsset(url);
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.workerApi = null;
    }
  }

  // Add this private method to handle worker initialization
  private async initializeWorker(): Promise<void> {
    console.log('Initializing update worker service...');
    
    // Add visibility change listener
    document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    
    this.worker = new Worker(
      new URL("../workers/updateWorker.ts", import.meta.url),
      { type: "module" },
    );

    // Set up message handler
    this.worker.addEventListener('message', this.handleWorkerMessage.bind(this));

    // Create proxy to worker with proper typing
    this.workerApi = Comlink.wrap<WorkerApi>(this.worker);
    
    // First load tokens if they haven't been loaded yet
    const tokens = get(tokenStore);
    if (!tokens?.tokens?.length) {
      await tokenStore.loadTokens();
    }
    
    // Send tokens to the worker
    await this.workerApi.setTokens(tokens.tokens);

    // Start updates and wait for initial data
    const updateStarted = await this.startUpdates();
    if (!updateStarted) {
      console.warn('Failed to start worker updates, falling back to direct updates');
      this.startFallbackUpdates();
      return;
    }
    
    this.isInitialized = true;
  }
}

export const updateWorkerService = new UpdateWorkerService();

