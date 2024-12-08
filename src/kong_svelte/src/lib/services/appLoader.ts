import { browser } from "$app/environment";
import { tokenStore } from "$lib/services/tokens/tokenStore";
import { poolStore } from "$lib/services/pools/poolStore";
import { get, writable, type Readable } from "svelte/store";
import { auth, canisterIDLs } from "$lib/services/auth";
import { assetCache } from "$lib/services/assetCache";
import { canisterId as kongBackendCanisterId } from "../../../../declarations/kong_backend";
import { updateWorkerService } from "$lib/services/updateWorkerService";
import { fetchTokens } from "./indexer/api";

interface LoadingState {
  isLoading: boolean;
  assetsLoaded: number;
  totalAssets: number;
  errors: string[];
}

export class AppLoader {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;

  // Create a writable store for loading state
  private _loadingState = writable<LoadingState>({
    isLoading: true,
    assetsLoaded: 0,
    totalAssets: 0,
    errors: [],
  });

  // Expose only the readable store
  public loadingState: Readable<LoadingState> = {
    subscribe: this._loadingState.subscribe,
  };

  public updateLoadingState(partial: Partial<LoadingState>) {
    const current = get(this._loadingState);
    this._loadingState.set({
      ...current,
      ...partial,
      // Only update progress if new values are provided
      assetsLoaded: partial.assetsLoaded ?? current.assetsLoaded,
      totalAssets: partial.totalAssets ?? current.totalAssets,
    });
  }

  // Asset preloading with priority, batching, and tracking
  private shouldSkipPreload(url: string): boolean {
    return url.startsWith("data:image/") || url.startsWith("blob:");
  }

  /**
   * Determines the type of asset based on its file extension.
   * @param url The URL of the asset.
   * @returns The asset type: "svg", "image", or "other".
   */
  private determineAssetType(url: string): "svg" | "image" | "other" {
    const extension = url.split(".").pop()?.toLowerCase();
    if (extension === "svg") return "svg";
    const imageExtensions = [
      "png",
      "jpg",
      "jpeg",
      "webp",
      "gif",
      "bmp",
      "ico",
      "svg",
    ];
    if (extension && imageExtensions.includes(extension)) return "image";
    return "other";
  }

  private async preloadAsset(
    url: string,
    priority: "high" | "low" = "high",
  ): Promise<void> {
    if (!browser || this.shouldSkipPreload(url)) {
      return;
    }

    try {
      // Get cached or fetch new asset
      const assetUrl = await assetCache.getAsset(url);
      const type = this.determineAssetType(url);

      if (type === "svg") {
        const response = await fetch(assetUrl);
        if (!response.ok) {
          throw new Error(`Failed to load SVG: ${response.statusText}`);
        }
        const svgContent = await response.text();
        if (!svgContent.includes("<svg")) {
          throw new Error("Invalid SVG content");
        }
      } else if (type === "image") {
        // For regular images, use the Image object loading approach
        await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(undefined);
          img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
          img.src = assetUrl;
        });
      } else {
        console.warn(`Unsupported asset type for URL: ${url}`);
      }

      // Update loading progress
      this._loadingState.update((state) => ({
        ...state,
        assetsLoaded: state.assetsLoaded + 1,
      }));
    } catch (error) {
      console.error(`Failed to preload asset ${url}:`, error);
      this._loadingState.update((state) => ({
        ...state,
        errors: [...state.errors, `Failed to load ${url}`],
        // Still increment loaded count even on error to ensure progress continues
        assetsLoaded: state.assetsLoaded + 1,
      }));
    }
  }

  private backgrounds = [
    "/backgrounds/skyline.svg",
  ];

  private async preloadAssets(): Promise<void> {
    try {
      // Get token logos from tokenStore
      const allAssets = [
        ...this.backgrounds,
        '/tokens/not_verified.webp' // Add fallback image
      ];
      
      this.updateLoadingState({
        totalAssets: allAssets.length,
      });

      const result = await updateWorkerService.preloadAssets(allAssets);
      this.updateLoadingState({
        assetsLoaded: result.loaded,
        errors: result.errors
      });
    } catch (error) {
      console.error('Failed to preload assets:', error);
      this.updateLoadingState({
        errors: [...get(this._loadingState).errors, 'Failed to preload assets'],
      });
    }
  }

  public async initialize(): Promise<void> {
    // If already initialized, return immediately
    if (this.initialized) {
      return;
    }

    // If initialization is in progress, wait for it
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Create new initialization promise
    this.initializationPromise = (async () => {
      try {
        await this.initializeTokens();
        await this.initializeUpdateWorker();
        this.initialized = true;
      } catch (error) {
        console.error("AppLoader initialization error:", error);
        // Reset initialization state on error
        this.initialized = false;
        this.initializationPromise = null;
        throw error;
      }
    })();

    return this.initializationPromise;
  }

  private async initializeTokens(): Promise<void> {
    try {
      // Initialize tokens after wallet connection
      const wallet = get(auth);

      // Load pools first, then tokens
      await poolStore.loadPools();
      
      // Load tokens and wait for completion
      await Promise.all([
        tokenStore.loadTokens(),
      ]);

      // If wallet is connected, load balances
      console.log(wallet);
      if (wallet?.isConnected && wallet?.account?.owner) {
        await tokenStore.loadBalances(wallet.account.owner);
      }
    } catch (error) {
      console.error("Failed to initialize tokens:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Token initialization failed: ${errorMessage}`);
    }
  }

  private async initializeUpdateWorker(): Promise<void> {
    try {
      // Initialize worker but don't wait for it to be fully ready
      await updateWorkerService.initialize().catch(error => {
        console.warn('Worker initialization failed, continuing with fallback updates:', error);
      });
    } catch (error) {
      console.error("Failed to initialize worker:", error);
      throw error;
    }
  }

  public destroy(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

export const appLoader = new AppLoader();
