import { loadPools } from "$lib/services/pools/poolStore";
import { get, writable, type Readable } from "svelte/store";
import { TokenService } from "./tokens";

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

  public async initialize(): Promise<void> {
    // If already initialized, return immediately
    if (this.initialized) {
      console.log("[AppLoader] Already initialized, skipping");
      return;
    }

    // If initialization is in progress, wait for it
    if (this.initializationPromise) {
      console.log("[AppLoader] Initialization already in progress, waiting...");
      return this.initializationPromise;
    }

    console.log("[AppLoader] Starting initialization...");
    // Create new initialization promise
    this.initializationPromise = (async () => {
      try {
        await this.initializeTokens();
        this.initialized = true;
        console.log("[AppLoader] Initialization completed successfully");
      } catch (error) {
        console.error("[AppLoader] Initialization error:", error);
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
      // Run token and pool loading in parallel
      await Promise.all([
        TokenService.fetchTokens(),
        loadPools()
      ]);
    } catch (error) {
      console.error("[AppLoader] Failed to initialize tokens:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Token initialization failed: ${errorMessage}`);
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
